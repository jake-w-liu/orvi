import { execFileSync, spawnSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

const packageRoot = resolve(__dirname, "..");
const cliPath = join(packageRoot, "dist", "cli.js");

function runLux(args: string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: packageRoot,
    encoding: "utf8"
  });
}

describe("Lux CLI", () => {
  let workspace: string;

  beforeAll(() => {
    execFileSync("npm", ["run", "build"], {
      cwd: packageRoot,
      stdio: "pipe"
    });
  });

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "lux-cli-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it("prints machine-readable check diagnostics as JSON", () => {
    const validPath = join(workspace, "valid.lux");
    writeFileSync(validPath, "# Title\n\nBody\n");

    const result = runLux(["check", validPath, "--json"]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(payload).toEqual({ ok: true, diagnostics: [] });
  });

  it("exits non-zero for JSON check output with error diagnostics", () => {
    const invalidPath = join(workspace, "invalid.lux");
    writeFileSync(invalidPath, "[chart]\nbad\n[]\n");

    const result = runLux(["check", invalidPath, "--json"]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");
    expect(payload.ok).toBe(false);
    expect(payload.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "LUX_UNKNOWN_COMPONENT"
        })
      ])
    );
  });

  it("checks formatter status without writing files", () => {
    const formattedPath = join(workspace, "formatted.lux");
    writeFileSync(formattedPath, "# Title\n\nBody\n");

    const formattedResult = runLux(["format", formattedPath, "--check"]);

    expect(formattedResult.status).toBe(0);
    expect(formattedResult.stdout).toContain("is already formatted");

    const unformattedPath = join(workspace, "unformatted.lux");
    const unformattedSource = "# Title\nBody\n";
    writeFileSync(unformattedPath, unformattedSource);

    const unformattedResult = runLux(["format", unformattedPath, "--check"]);

    expect(unformattedResult.status).toBe(1);
    expect(unformattedResult.stdout).toContain("is not formatted");
    expect(readFileSync(unformattedPath, "utf8")).toBe(unformattedSource);
  });

  it("prints JSON diagnostics for format check failures", () => {
    const invalidPath = join(workspace, "invalid-format.lux");
    writeFileSync(invalidPath, "[chart]\n");

    const result = runLux(["format", invalidPath, "--check", "--json"]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");
    expect(payload.ok).toBe(false);
    expect(payload.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "LUX_UNKNOWN_COMPONENT"
        })
      ])
    );
  });

  it("passes lux.config.js language, direction, and color scheme into builds", () => {
    const inputPath = join(workspace, "configured.lux");
    const outputPath = join(workspace, "configured.html");
    writeFileSync(inputPath, "# Configured\n");
    writeFileSync(
      join(workspace, "lux.config.js"),
      `module.exports = { title: "Configured", lang: "ar", dir: "rtl", colorScheme: "dark" };\n`
    );

    const result = runLux(["build", inputPath, "-o", outputPath]);
    const html = readFileSync(outputPath, "utf8");

    expect(result.status).toBe(0);
    expect(html).toContain('<html lang="ar" dir="rtl" class="lux-theme-dark">');
    expect(html).toContain("<title>Configured</title>");
  });

  it("uses document metadata before filename fallback for build titles", () => {
    const inputPath = join(workspace, "metadata-title.lux");
    const outputPath = join(workspace, "metadata-title.html");
    writeFileSync(
      inputPath,
      `---
lux: 0.1
title: Metadata Title
---

# Body
`
    );

    const result = runLux(["build", inputPath, "-o", outputPath]);
    const html = readFileSync(outputPath, "utf8");

    expect(result.status).toBe(0);
    expect(html).toContain("<title>Metadata Title</title>");
  });
});
