import { cpSync, existsSync, rmSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const extensionRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = resolve(extensionRoot, "..", "..");
const distPath = resolve(repoRoot, "dist");
const runtimePath = resolve(extensionRoot, "runtime");

execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
  cwd: repoRoot,
  stdio: "inherit"
});

if (!existsSync(resolve(distPath, "cli.js"))) {
  throw new Error("Orvi build did not produce dist/cli.js.");
}

rmSync(runtimePath, { force: true, recursive: true });
cpSync(distPath, runtimePath, { recursive: true });

console.log("Prepared bundled Orvi runtime for the VS Code extension.");
