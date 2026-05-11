// Generates src/styles.ts from src/orvi-base.css so the inlined `defaultCss`
// string and the shipped stylesheet can never drift. Run `npm run css:sync`
// after editing src/orvi-base.css. `--check` fails (exit 1) when out of date.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = join(repoRoot, "src", "orvi-base.css");
const stylesPath = join(repoRoot, "src", "styles.ts");

const css = readFileSync(cssPath, "utf8");

// Escape for a JS template literal: backslash, backtick, and ${ interpolation.
const escaped = css.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const generated = `// AUTO-GENERATED FROM src/orvi-base.css — DO NOT EDIT.
// Edit src/orvi-base.css instead, then run \`npm run css:sync\`.
export const defaultCss = \`${escaped}\`;
`;

const checkMode = process.argv.includes("--check");

if (checkMode) {
  const current = readFileSync(stylesPath, "utf8");
  if (current !== generated) {
    console.error("src/styles.ts is out of date with src/orvi-base.css. Run `npm run css:sync`.");
    process.exit(1);
  }
  console.log("src/styles.ts is in sync with src/orvi-base.css.");
} else {
  writeFileSync(stylesPath, generated);
  console.log("Regenerated src/styles.ts from src/orvi-base.css.");
}
