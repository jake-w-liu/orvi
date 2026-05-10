import { appendFile, copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pluginDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(pluginDir, "..", "..");
const runtimeDir = join(pluginDir, "runtime");

const runtimeFiles = ["ast.js", "parser.js", "renderer.js", "styles.js"];

await rm(runtimeDir, { recursive: true, force: true });
await mkdir(runtimeDir, { recursive: true });

for (const file of runtimeFiles) {
  await copyFile(join(repoRoot, "dist", file), join(runtimeDir, file));
}

await copyFile(join(repoRoot, "src", "lux-base.css"), join(pluginDir, "styles.css"));
await appendFile(
  join(pluginDir, "styles.css"),
  `

.lux-obsidian-render .lux-document {
  max-width: none;
  padding: 0;
}

.lux-render-error {
  border: 1px solid var(--background-modifier-error);
  color: var(--text-error);
  padding: 0.75rem;
  white-space: pre-wrap;
}

.lux-render-diagnostics {
  border: 1px solid var(--background-modifier-border);
  margin-top: 1rem;
  padding: 0.5rem 0.75rem;
}

@media (max-width: 720px) {
  .lux-obsidian-render .lux-document {
    padding: 0;
  }
}
`
);

console.log("Built integrations/obsidian-lux runtime files.");
