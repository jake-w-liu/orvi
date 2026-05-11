import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { renderOrvi } from "../dist/esm/renderer.js";

const root = dirname(
  fileURLToPath(new URL("../package.json", import.meta.url)),
);
const siteDir = join(root, ".site");
const skippedDirs = new Set([
  ".git",
  ".github",
  ".site",
  "dist",
  "node_modules",
]);

await rm(siteDir, { force: true, recursive: true });
await mkdir(siteDir, { recursive: true });

await cp(join(root, "playground"), join(siteDir, "playground"), {
  recursive: true,
});
await cp(join(root, "dist", "esm"), join(siteDir, "dist", "esm"), {
  recursive: true,
});
await cp(
  join(root, "dist", "orvi-base.css"),
  join(siteDir, "dist", "orvi-base.css"),
);
await mkdir(join(siteDir, "examples"), { recursive: true });
await cp(
  join(root, "examples", "welcome.html"),
  join(siteDir, "examples", "welcome.html"),
);
await cp(join(root, "schemas"), join(siteDir, "schemas"), { recursive: true });
const renderedOrviFiles = await renderOrviFiles();

const packageJson = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
);
const pagesCname = process.env.ORVI_PAGES_CNAME?.trim();
await writeFile(join(siteDir, "index.html"), await buildLandingPage());
if (pagesCname) {
  await writeFile(join(siteDir, "CNAME"), `${pagesCname}\n`);
}
await writeFile(join(siteDir, ".nojekyll"), "");
await writeFile(
  join(siteDir, "version.json"),
  `${JSON.stringify({ name: packageJson.name, version: packageJson.version, renderedOrviFiles }, null, 2)}\n`,
);

async function buildLandingPage() {
  const landingSource = await readFile(
    join(root, "examples", "getting-started.ov"),
    "utf8",
  );
  const result = renderOrvi(landingSource, {
    fullDocument: true,
    title: "Orvi — a strict, human-writable markup language",
  });

  const nav = `<nav style="display:flex;flex-wrap:wrap;gap:1rem;align-items:baseline;max-width:46rem;margin:1rem auto 0;padding:0 1rem;font:14px/1.5 system-ui,sans-serif">
  <strong style="font-size:15px">Orvi</strong>
  <a href="playground/">Playground</a>
  <a href="rendered/">Rendered examples</a>
  <a href="https://github.com/jake-w-liu/orvi">GitHub</a>
  <a href="https://marketplace.visualstudio.com/items?itemName=jake-w-liu.orvi-language">VS Code extension</a>
</nav>`;

  return result.html.replace("<body>", `<body>\n${nav}`);
}

async function renderOrviFiles() {
  const sourceFiles = await findOrviFiles(root);
  const rendered = [];
  for (const sourcePath of sourceFiles) {
    const relativePath = relative(root, sourcePath);
    const outputPath = join(siteDir, "rendered", `${relativePath}.html`);
    const source = await readFile(sourcePath, "utf8");
    const result = renderOrvi(source, {
      fullDocument: true,
      fallbackTitle: relativePath,
    });

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, result.html);
    rendered.push({
      source: relativePath,
      output: `rendered/${relativePath}.html`,
      diagnostics: result.ast.diagnostics.length,
    });
  }

  await writeRenderedIndex(rendered);
  return rendered;
}

async function findOrviFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isDirectory()) {
        if (skippedDirs.has(entry.name)) return [];
        return findOrviFiles(join(dir, entry.name));
      }

      const path = join(dir, entry.name);
      return path.endsWith(".ov") ? [path] : [];
    }),
  );

  return files.flat().sort();
}

async function writeRenderedIndex(files) {
  const rows = files
    .map((file) => {
      const href = file.output.startsWith("rendered/") ? file.output.slice("rendered/".length) : file.output;
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(file.source)}</a>${
        file.diagnostics ? ` (${file.diagnostics} diagnostics)` : ""
      }</li>`;
    })
    .join("\n");

  await mkdir(join(siteDir, "rendered"), { recursive: true });
  await writeFile(
    join(siteDir, "rendered", "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Rendered Orvi Files</title>
    <link rel="stylesheet" href="../dist/orvi-base.css">
  </head>
  <body>
    <main class="orvi-document">
      <h1>Rendered Orvi Files</h1>
      <ul class="orvi-list">
        ${rows || "<li>No Orvi files found.</li>"}
      </ul>
    </main>
  </body>
</html>
`,
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char];
  });
}
