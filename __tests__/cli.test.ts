import { execFileSync, spawnSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

const packageRoot = resolve(__dirname, "..");
const cliPath = join(packageRoot, "dist", "cli.js");

function runOrvi(args: string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: packageRoot,
    encoding: "utf8"
  });
}

describe("Orvi CLI", () => {
  let workspace: string;

  beforeAll(() => {
    execFileSync("npm", ["run", "build"], {
      cwd: packageRoot,
      stdio: "pipe"
    });
  });

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "orvi-cli-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it("prints machine-readable check diagnostics as JSON", () => {
    const validPath = join(workspace, "valid.ov");
    writeFileSync(validPath, "# Title\n\nBody\n");

    const result = runOrvi(["check", validPath, "--json"]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(payload).toEqual({ ok: true, diagnostics: [] });
  });

  it("exits non-zero for JSON check output with error diagnostics", () => {
    const invalidPath = join(workspace, "invalid.ov");
    writeFileSync(invalidPath, "[chart]\nbad\n[]\n");

    const result = runOrvi(["check", invalidPath, "--json"]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");
    expect(payload.ok).toBe(false);
    expect(payload.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "ORVI_UNKNOWN_COMPONENT"
        })
      ])
    );
  });

  it("checks formatter status without writing files", () => {
    const formattedPath = join(workspace, "formatted.ov");
    writeFileSync(formattedPath, "# Title\n\nBody\n");

    const formattedResult = runOrvi(["format", formattedPath, "--check"]);

    expect(formattedResult.status).toBe(0);
    expect(formattedResult.stdout).toContain("is already formatted");

    const unformattedPath = join(workspace, "unformatted.ov");
    const unformattedSource = "# Title\nBody\n";
    writeFileSync(unformattedPath, unformattedSource);

    const unformattedResult = runOrvi(["format", unformattedPath, "--check"]);

    expect(unformattedResult.status).toBe(1);
    expect(unformattedResult.stdout).toContain("is not formatted");
    expect(readFileSync(unformattedPath, "utf8")).toBe(unformattedSource);
  });

  it("prints JSON diagnostics for format check failures", () => {
    const invalidPath = join(workspace, "invalid-format.ov");
    writeFileSync(invalidPath, "[chart]\n");

    const result = runOrvi(["format", invalidPath, "--check", "--json"]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");
    expect(payload.ok).toBe(false);
    expect(payload.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ORVI_UNKNOWN_COMPONENT"
        })
      ])
    );
  });

  it("passes orvi.config.js language, direction, and color scheme into builds", () => {
    const inputPath = join(workspace, "configured.ov");
    const outputPath = join(workspace, "configured.html");
    writeFileSync(inputPath, "# Configured\n");
    writeFileSync(
      join(workspace, "orvi.config.js"),
      `module.exports = { title: "Configured", lang: "ar", dir: "rtl", colorScheme: "dark" };\n`
    );

    const result = runOrvi(["build", inputPath, "-o", outputPath]);
    const html = readFileSync(outputPath, "utf8");

    expect(result.status).toBe(0);
    expect(html).toContain('<html lang="ar" dir="rtl" class="orvi-theme-dark">');
    expect(html).toContain("<title>Configured</title>");
  });

  it("uses document metadata before filename fallback for build titles", () => {
    const inputPath = join(workspace, "metadata-title.ov");
    const outputPath = join(workspace, "metadata-title.html");
    writeFileSync(
      inputPath,
      `---
orvi: 0.1
title: Metadata Title
---

# Body
`
    );

    const result = runOrvi(["build", inputPath, "-o", outputPath]);
    const html = readFileSync(outputPath, "utf8");

    expect(result.status).toBe(0);
    expect(html).toContain("<title>Metadata Title</title>");
  });
});
