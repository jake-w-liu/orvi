import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, join } from "node:path";

const esmDirUrl = new URL("../dist/esm/", import.meta.url);
const esmDir = fileURLToPath(esmDirUrl);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : path;
    })
  );

  return files.flat();
}

function withJsExtension(specifier) {
  if (!specifier.startsWith(".") || extname(specifier)) {
    return specifier;
  }

  return `${specifier}.js`;
}

function rewriteRelativeSpecifiers(source) {
  return source
    .replace(/\b(from\s*["'])(\.[^"']+)(["'])/g, (_, before, specifier, after) => {
      return `${before}${withJsExtension(specifier)}${after}`;
    })
    .replace(/\b(import\s*\(\s*["'])(\.[^"']+)(["']\s*\))/g, (_, before, specifier, after) => {
      return `${before}${withJsExtension(specifier)}${after}`;
    })
    .replace(/\b(import\s*["'])(\.[^"']+)(["'])/g, (_, before, specifier, after) => {
      return `${before}${withJsExtension(specifier)}${after}`;
    });
}

await writeFile(new URL("package.json", esmDirUrl), `${JSON.stringify({ type: "module" }, null, 2)}\n`);

const files = await walk(esmDir);
await Promise.all(
  files
    .filter((file) => file.endsWith(".js"))
    .map(async (file) => {
      const source = await readFile(file, "utf8");
      const rewritten = rewriteRelativeSpecifiers(source);

      if (rewritten !== source) {
        await writeFile(file, rewritten);
      }
    })
);
