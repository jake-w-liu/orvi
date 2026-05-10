import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { renderLux } from "../dist/esm/renderer.js";

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
  join(root, "dist", "lux-base.css"),
  join(siteDir, "dist", "lux-base.css"),
);
await mkdir(join(siteDir, "examples"), { recursive: true });
await cp(
  join(root, "examples", "welcome.html"),
  join(siteDir, "examples", "welcome.html"),
);
await cp(join(root, "schemas"), join(siteDir, "schemas"), { recursive: true });
const renderedLuxFiles = await renderLuxFiles();

const packageJson = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
);
const pagesCname = process.env.LUX_PAGES_CNAME?.trim();
await writeFile(
  join(siteDir, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Lux Playground</title>
    <meta http-equiv="refresh" content="0; url=/playground/">
    <link rel="canonical" href="/playground/">
  </head>
  <body>
    <p><a href="/playground/">Open Lux Playground</a></p>
    <p><a href="/rendered/">Browse rendered Lux files</a></p>
  </body>
</html>
`,
);
if (pagesCname) {
  await writeFile(join(siteDir, "CNAME"), `${pagesCname}\n`);
}
await writeFile(join(siteDir, ".nojekyll"), "");
await writeFile(
  join(siteDir, "version.json"),
  `${JSON.stringify({ name: packageJson.name, version: packageJson.version, renderedLuxFiles }, null, 2)}\n`,
);

async function renderLuxFiles() {
  const sourceFiles = await findLuxFiles(root);
  const rendered = [];
  for (const sourcePath of sourceFiles) {
    const relativePath = relative(root, sourcePath);
    const outputPath = join(siteDir, "rendered", `${relativePath}.html`);
    const source = await readFile(sourcePath, "utf8");
    const result = renderLux(source, {
      fullDocument: true,
      fallbackTitle: relativePath,
    });

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, result.html);
    rendered.push({
      source: relativePath,
      output: `/rendered/${relativePath}.html`,
      diagnostics: result.ast.diagnostics.length,
    });
  }

  await writeRenderedIndex(rendered);
  return rendered;
}

async function findLuxFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isDirectory()) {
        if (skippedDirs.has(entry.name)) return [];
        return findLuxFiles(join(dir, entry.name));
      }

      const path = join(dir, entry.name);
      return path.endsWith(".lux") ? [path] : [];
    }),
  );

  return files.flat().sort();
}

async function writeRenderedIndex(files) {
  const rows = files
    .map((file) => {
      return `<li><a href="${escapeHtml(file.output)}">${escapeHtml(file.source)}</a>${
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
    <title>Rendered Lux Files</title>
    <link rel="stylesheet" href="/dist/lux-base.css">
  </head>
  <body>
    <main class="lux-document">
      <h1>Rendered Lux Files</h1>
      <ul class="lux-list">
        ${rows || "<li>No Lux files found.</li>"}
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
