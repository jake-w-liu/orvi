#!/usr/bin/env node
// Print the CHANGELOG.md section for a given version (e.g. `0.2.4`).
// Usage: node scripts/extract-changelog.mjs <version>
// Exits non-zero if the section is missing.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/extract-changelog.mjs <version>");
  process.exit(2);
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const changelog = readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8");
const lines = changelog.split("\n");

// A version heading is `## <version>` optionally followed by ` — <title>`.
const isVersionHeading = (line) => /^##\s+/.test(line);
const matchesVersion = (line) =>
  isVersionHeading(line) && new RegExp(`^##\\s+${escapeRegExp(version)}(\\s|$)`).test(line);

const start = lines.findIndex(matchesVersion);
if (start === -1) {
  console.error(`No CHANGELOG.md section found for version ${version}.`);
  process.exit(1);
}

let end = lines.length;
for (let i = start + 1; i < lines.length; i++) {
  if (isVersionHeading(lines[i])) {
    end = i;
    break;
  }
}

const section = lines.slice(start + 1, end).join("\n").trim();
process.stdout.write(section + "\n");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
