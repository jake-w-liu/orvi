#!/usr/bin/env node
// Bump the Obsidian plugin version: update manifest.json and add the
// version -> minAppVersion mapping to versions.json (Obsidian's required layout).
// Usage: node scripts/set-obsidian-version.mjs <version>
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: node scripts/set-obsidian-version.mjs <major.minor.patch>");
  process.exit(2);
}

const pluginDir = join(dirname(fileURLToPath(import.meta.url)), "..", "integrations", "obsidian-orvi");
const manifestPath = join(pluginDir, "manifest.json");
const versionsPath = join(pluginDir, "versions.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const minAppVersion = manifest.minAppVersion;
manifest.version = version;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

const versions = JSON.parse(readFileSync(versionsPath, "utf8"));
versions[version] = minAppVersion;
writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + "\n");

console.log(`Set Obsidian plugin version to ${version} (minAppVersion ${minAppVersion}).`);
