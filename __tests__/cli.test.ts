import { ChildProcessWithoutNullStreams, execFileSync, spawn, spawnSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { get } from "http";
import { AddressInfo, createServer as createNetServer } from "net";
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

  it("refuses to write formatting output when diagnostics warn about data loss", () => {
    const commentPath = join(workspace, "comment.ov");
    const source = "// keep this note\n# Title\n";
    writeFileSync(commentPath, source);

    const result = runOrvi(["format", commentPath, "--write"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ORVI_FORMAT_COMMENT_DROPPED");
    expect(readFileSync(commentPath, "utf8")).toBe(source);
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

  it("prints the package version with `orvi version` and `orvi --version`", () => {
    const version = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version;

    expect(runOrvi(["version"]).stdout.trim()).toBe(version);
    expect(runOrvi(["--version"]).stdout.trim()).toBe(version);
    expect(runOrvi(["version"]).status).toBe(0);
  });

  it("honors an explicit --config path and errors on a missing one", () => {
    const inputPath = join(workspace, "configured.ov");
    const outputPath = join(workspace, "configured.html");
    const configPath = join(workspace, "custom.orvi.config.js");
    writeFileSync(inputPath, "# Configured\n");
    writeFileSync(configPath, `module.exports = { title: "FromCustomConfig", colorScheme: "dark" };\n`);

    const ok = runOrvi(["build", inputPath, "-o", outputPath, "--config", configPath]);
    expect(ok.status).toBe(0);
    const html = readFileSync(outputPath, "utf8");
    expect(html).toContain("<title>FromCustomConfig</title>");
    expect(html).toContain("orvi-theme-dark");

    const missing = runOrvi(["build", inputPath, "--config", join(workspace, "nope.js")]);
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain("Config file not found");
  });

  it("renders a viewable HTML file with `orvi view --no-open`", () => {
    const inputPath = join(workspace, "viewable.ov");
    writeFileSync(inputPath, "# Viewable\n\n[green bold] rendered []\n");

    const result = runOrvi(["view", inputPath, "--no-open"]);

    expect(result.status).toBe(0);
    const builtLine = result.stdout.toString().trim();
    expect(builtLine).toMatch(/^Built .*orvi-view-viewable-\d+\.html$/);
    const outputPath = builtLine.replace(/^Built /, "");
    const html = readFileSync(outputPath, "utf8");
    expect(html).toContain("<h1>Viewable</h1>");
    expect(html).toContain("orvi-text-green");
    rmSync(outputPath, { force: true });
  });

  it("exits non-zero for `orvi view` on a document with errors", () => {
    const inputPath = join(workspace, "view-invalid.ov");
    writeFileSync(inputPath, "[bogus]\nx\n[/bogus]\n");

    const result = runOrvi(["view", inputPath, "--no-open"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr.toString()).toContain("ORVI_UNKNOWN_COMPONENT");
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

  it("escapes diagnostics in the preview server panel", async () => {
    const inputPath = join(workspace, "invalid-preview.ov");
    writeFileSync(
      inputPath,
      `[callout type="<script>"]
Bad
[/callout]`
    );
    const port = await getAvailablePort();
    const server = spawn(process.execPath, [cliPath, "serve", inputPath, "--port", String(port)], {
      cwd: packageRoot
    });

    try {
      await waitForOutput(server, "Orvi preview");
      const response = await getText(`http://127.0.0.1:${port}/`);

      expect(response.statusCode).toBe(422);
      expect(response.body).toContain("&lt;script&gt;");
      expect(response.body).not.toContain("Unknown callout type '&quot;<script>&quot;'");
      expect(response.body).not.toContain('orvi-callout-"<script>"');
    } finally {
      server.kill();
    }
  });

  it("serves warning-only documents with a successful status", async () => {
    const inputPath = join(workspace, "warning-preview.ov");
    writeFileSync(
      inputPath,
      `---
extra: value
---

# Warn only`
    );
    const port = await getAvailablePort();
    const server = spawn(process.execPath, [cliPath, "serve", inputPath, "--port", String(port)], {
      cwd: packageRoot
    });

    try {
      await waitForOutput(server, "Orvi preview");
      const response = await getText(`http://127.0.0.1:${port}/`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("ORVI_UNKNOWN_METADATA");
    } finally {
      server.kill();
    }
  });

  it("serves the document at the root path and 404s unknown paths", async () => {
    const inputPath = join(workspace, "routes-preview.ov");
    writeFileSync(inputPath, "# Routes\n\nbtn: Go -> /x\n");
    const port = await getAvailablePort();
    const server = spawn(process.execPath, [cliPath, "serve", inputPath, "--port", String(port)], {
      cwd: packageRoot
    });

    try {
      await waitForOutput(server, "Orvi preview");

      const root = await getText(`http://127.0.0.1:${port}/`);
      expect(root.statusCode).toBe(200);
      expect(root.body).toContain("<h1>Routes</h1>");

      const withQuery = await getText(`http://127.0.0.1:${port}/?reload=1`);
      expect(withQuery.statusCode).toBe(200);

      const missing = await getText(`http://127.0.0.1:${port}/does-not-exist`);
      expect(missing.statusCode).toBe(404);
    } finally {
      server.kill();
    }
  });
});

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

function waitForOutput(server: ChildProcessWithoutNullStreams, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for CLI output: ${text}\n${output}`));
    }, 5000);
    server.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
      if (output.includes(text)) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    server.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    server.once("exit", (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`CLI exited before expected output: code=${code} signal=${signal}\n${output}`));
    });
  });
}

function getText(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({ statusCode: response.statusCode ?? 0, body });
      });
    }).on("error", reject);
  });
}
