// Fails (exit 1) when the committed Obsidian runtime copy has drifted from the
// freshly built `dist/`. Run AFTER `npm run build`. Regenerate with
// `npm run obsidian:build` and commit. Analogous to `css:sync:check`.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(repoRoot, "dist");
const runtimeDir = join(repoRoot, "integrations", "obsidian-orvi", "runtime");

// Must match `integrations/obsidian-orvi/build.mjs`.
const files = ["ast.js", "constants.js", "html.js", "parser.js", "renderer.js", "styles.js"];

const stale = [];
for (const file of files) {
  let dist;
  try {
    dist = readFileSync(join(distDir, file), "utf8");
  } catch {
    console.error(`Missing dist/${file}. Run \`npm run build\` before this check.`);
    process.exit(1);
  }
  let runtime;
  try {
    runtime = readFileSync(join(runtimeDir, file), "utf8");
  } catch {
    runtime = undefined;
  }
  if (runtime !== dist) stale.push(file);
}

if (stale.length > 0) {
  console.error(`Obsidian runtime is out of date with dist: ${stale.join(", ")}.`);
  console.error("Run `npm run obsidian:build` and commit the regenerated runtime.");
  process.exit(1);
}

console.log(`Obsidian runtime is in sync with dist (${files.length} files).`);
