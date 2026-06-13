#!/usr/bin/env node
import { spawn } from "child_process";
import { createServer, ServerResponse } from "http";
import { existsSync, mkdtempSync, readFileSync, statSync, watch, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, dirname, extname, join, resolve } from "path";
import { defaultCss, OrviColorScheme, OrviDirection, OrviTheme, renderOrvi } from "./renderer";
import { parseOrvi } from "./parser";
import { OrviDiagnostic } from "./ast";
import { formatOrvi } from "./formatter";

interface BuildArgs {
  input: string;
  output?: string;
  config?: string;
}

interface ViewArgs {
  input: string;
  open: boolean;
  config?: string;
}

interface ServeArgs {
  input: string;
  port: number;
  config?: string;
}

interface FormatArgs {
  input: string;
  write: boolean;
  check: boolean;
  json: boolean;
}

interface CheckArgs {
  input: string;
  json: boolean;
}

interface OrviConfig {
  title?: string;
  lang?: string;
  dir?: OrviDirection;
  colorScheme?: OrviColorScheme;
  theme?: OrviTheme;
  css?: string;
}

const FLAGS_WITH_VALUES = new Set(["-o", "--output", "--config", "--port", "-p"]);

const args = process.argv.slice(2);
const command = args[0];
// Normalize `--flag=value` / `-o=value` into separate tokens so the value-flag
// parsers (which match flags by exact token) accept the common `=`-joined form.
const operands = splitInlineValues(args.slice(1));

try {
  if (command === "build") {
    build(parseBuildArgs(operands));
  } else if (command === "view") {
    view(parseViewArgs(operands));
  } else if (command === "check") {
    check(parseCheckArgs(operands));
  } else if (command === "format") {
    format(parseFormatArgs(operands));
  } else if (command === "serve") {
    serve(parseServeArgs(operands));
  } else if (command === "version" || command === "--version" || command === "-v") {
    console.log(cliVersion());
  } else if (command === "help" || command === "--help" || command === "-h") {
    help();
  } else {
    help();
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function build(options: BuildArgs): void {
  const inputPath = resolve(options.input);
  const html = renderDocument(inputPath, options.config);
  const outputPath = resolve(options.output ?? defaultOutputPath(inputPath));
  // Never clobber the source. The default output path collides with the input
  // when the input already ends in `.html`, and an explicit `-o` can also point
  // back at it. A string compare misses case-insensitive filesystems and
  // symlinks, so compare by identity (device + inode) for paths that exist.
  if (isSameFile(outputPath, inputPath)) {
    throw new Error(`Refusing to overwrite the input file ${inputPath}. Pass -o <output.html> to choose a different path.`);
  }
  writeFileSync(outputPath, html);
  console.log(`Built ${outputPath}`);
}

function view(options: ViewArgs): void {
  const inputPath = resolve(options.input);
  const html = renderDocument(inputPath, options.config);
  // A fresh temp directory per invocation avoids cross-run collisions when two
  // documents share a basename.
  const outputDir = mkdtempSync(join(tmpdir(), "orvi-view-"));
  const outputPath = join(outputDir, `${basename(inputPath, extname(inputPath))}.html`);
  writeFileSync(outputPath, html);
  console.log(`Built ${outputPath}`);

  if (options.open) {
    openInBrowser(outputPath);
  }
}

function renderDocument(inputPath: string, configOverride?: string): string {
  assertReadable(inputPath);
  const config = loadConfig(inputPath, configOverride);
  const source = readFileSync(inputPath, "utf8");
  const result = renderOrvi(source, {
    fullDocument: true,
    title: config.title,
    fallbackTitle: basename(inputPath),
    lang: config.lang,
    dir: config.dir,
    colorScheme: config.colorScheme,
    includeCss: true,
    theme: config.theme,
    extraCss: config.css
  });

  failOnErrors(result.ast.diagnostics);
  return result.html;
}

function openInBrowser(target: string): void {
  const platform = process.platform;
  const command = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const commandArgs = platform === "win32" ? ["/c", "start", "", target] : [target];

  try {
    const child = spawn(command, commandArgs, { stdio: "ignore", detached: true });
    child.on("error", () => console.log(`Open this file in a browser: ${target}`));
    child.unref();
  } catch {
    console.log(`Open this file in a browser: ${target}`);
  }
}

function check(options: CheckArgs): void {
  const inputPath = resolve(options.input);
  assertReadable(inputPath);
  const ast = parseOrvi(readFileSync(inputPath, "utf8"));

  if (options.json) {
    const ok = !hasErrorDiagnostics(ast.diagnostics);
    console.log(JSON.stringify({ ok, diagnostics: ast.diagnostics }, null, 2));
    if (!ok) process.exit(1);
    return;
  }

  failOnErrors(ast.diagnostics);
  console.log("Orvi check passed.");
}

function format(options: FormatArgs): void {
  const inputPath = resolve(options.input);
  assertReadable(inputPath);
  const source = readFileSync(inputPath, "utf8");
  const result = formatOrvi(source);

  if (options.check) {
    const ok = source === result.formatted && result.diagnostics.length === 0;
    if (options.json) {
      console.log(JSON.stringify({ ok, diagnostics: result.diagnostics }, null, 2));
    } else if (ok) {
      console.log(`${inputPath} is already formatted.`);
    } else if (result.diagnostics.length > 0) {
      failOnDiagnostics("Orvi format diagnostics:", result.diagnostics);
    } else {
      console.log(`${inputPath} is not formatted. Run orvi format ${inputPath} --write to update it.`);
    }

    if (!ok) process.exit(1);
    return;
  }

  failOnDiagnostics("Orvi format diagnostics:", result.diagnostics);

  if (options.write) {
    writeFileSync(inputPath, result.formatted);
    console.log(`Formatted ${inputPath}`);
    return;
  }

  process.stdout.write(result.formatted);
}

function serve(options: ServeArgs): void {
  const inputPath = resolve(options.input);
  assertReadable(inputPath);
  // Validate the config once up front (a bad --config path should fail loudly);
  // it is re-read per request so edits take effect without a restart.
  loadConfig(inputPath, options.config);
  const clients = new Set<ServerResponse>();

  const notifyReload = (): void => {
    for (const client of clients) client.write("data: reload\n\n");
  };

  // Watch the containing directory rather than the file inode: editors that
  // save by atomic rename/replace (VS Code, vim `:w`) would otherwise stop the
  // watch after the first save. Filter to the target file and debounce bursts.
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  const targetName = basename(inputPath);
  const watcher = watch(dirname(inputPath), { persistent: true }, (_event, filename) => {
    if (filename && basename(filename.toString()) !== targetName) return;
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(notifyReload, 50);
  });
  watcher.on("error", (error) => {
    console.error(`Orvi preview watch error: ${error instanceof Error ? error.message : String(error)}`);
  });

  const server = createServer((request, response) => {
    const path = (request.url ?? "/").split(/[?#]/)[0];

    if (path === "/__orvi/events") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      });
      response.write("\n");
      clients.add(response);
      // SSE comment heartbeat keeps proxies and idle browsers from dropping the stream.
      const heartbeat = setInterval(() => response.write(": ping\n\n"), 30000);
      request.on("close", () => {
        clearInterval(heartbeat);
        clients.delete(response);
      });
      return;
    }

    if (path === "/orvi-base.css") {
      response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      response.end(defaultCss);
      return;
    }

    if (path !== "/" && path !== "/index.html") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    try {
      const config = loadConfig(inputPath, options.config, true);
      const source = readFileSync(inputPath, "utf8");
      const result = renderOrvi(source, {
        fullDocument: true,
        title: config.title,
        fallbackTitle: basename(inputPath),
        lang: config.lang,
        dir: config.dir,
        colorScheme: config.colorScheme,
        includeCss: true,
        liveReload: true,
        theme: config.theme,
        extraCss: config.css
      });
      response.writeHead(hasErrorDiagnostics(result.ast.diagnostics) ? 422 : 200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(withDiagnostics(result.html, result.ast.diagnostics));
    } catch (error) {
      // e.g. the watched file was removed between requests — don't crash the server.
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(`Orvi preview error: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Orvi preview port ${options.port} is already in use. Pass --port <number> to choose another.`);
    } else {
      console.error(`Orvi preview server error: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exit(1);
  });

  server.listen(options.port, () => {
    console.log(`Orvi preview http://localhost:${options.port}`);
  });
}

function parseBuildArgs(values: string[]): BuildArgs {
  const input = firstPositional(values);
  if (!input) {
    // A trailing value-flag with no value is a clearer error than the usage line.
    const last = values[values.length - 1];
    if (last !== undefined && FLAGS_WITH_VALUES.has(last)) throw new Error(`Missing value for ${last}.`);
    throw new Error("Usage: orvi build <input.ov> [-o output.html] [--config orvi.config.js]");
  }

  let output: string | undefined;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "-o" || values[index] === "--output") {
      const next = values[index + 1];
      if (next === undefined || next.startsWith("-")) throw new Error("Missing value for -o.");
      output = next;
      index += 1;
    }
  }

  return { input, output, config: optionValue(values, "--config") };
}

function parseViewArgs(values: string[]): ViewArgs {
  const input = firstPositional(values);
  if (!input) throw new Error("Usage: orvi view <input.ov> [--no-open] [--config orvi.config.js]");

  return { input, open: !values.includes("--no-open"), config: optionValue(values, "--config") };
}

function parseServeArgs(values: string[]): ServeArgs {
  const input = firstPositional(values);
  if (!input) throw new Error("Usage: orvi serve <input.ov> [--port 4173] [--config orvi.config.js]");

  let port = 4173;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--port" || values[index] === "-p") {
      port = Number(values[index + 1]);
      index += 1;
    }
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port must be an integer from 1 to 65535.");
  }

  return { input, port, config: optionValue(values, "--config") };
}

function parseCheckArgs(values: string[]): CheckArgs {
  const input = firstPositional(values);
  if (!input) throw new Error("Usage: orvi check <input.ov> [--json]");

  return {
    input,
    json: values.includes("--json")
  };
}

function parseFormatArgs(values: string[]): FormatArgs {
  const input = firstPositional(values);
  if (!input) throw new Error("Usage: orvi format <input.ov> [--write] [--check]");

  return {
    input,
    write: values.includes("--write") || values.includes("-w"),
    check: values.includes("--check"),
    json: values.includes("--json")
  };
}

function firstPositional(values: string[]): string | undefined {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (FLAGS_WITH_VALUES.has(value)) {
      index += 1;
      continue;
    }
    if (!value.startsWith("-")) return value;
  }
  return undefined;
}

function optionValue(values: string[], flag: string): string | undefined {
  const index = values.indexOf(flag);
  if (index === -1) return undefined;
  const value = values[index + 1];
  if (value === undefined || value.startsWith("-")) throw new Error(`Missing value for ${flag}.`);
  return value;
}

function failOnErrors(diagnostics: OrviDiagnostic[]): void {
  const errors = errorDiagnostics(diagnostics);
  if (errors.length === 0) return;

  printDiagnostics("Orvi syntax errors:", errors);
  process.exit(1);
}

function failOnDiagnostics(title: string, diagnostics: OrviDiagnostic[]): void {
  if (diagnostics.length === 0) return;

  printDiagnostics(title, diagnostics);
  process.exit(1);
}

function hasErrorDiagnostics(diagnostics: OrviDiagnostic[]): boolean {
  return errorDiagnostics(diagnostics).length > 0;
}

function errorDiagnostics(diagnostics: OrviDiagnostic[]): OrviDiagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.severity === "error");
}

function printDiagnostics(title: string, diagnostics: OrviDiagnostic[]): void {
  console.error(title);
  for (const diagnostic of diagnostics) {
    console.error(`${diagnostic.line}:${diagnostic.column} ${diagnostic.code} ${diagnostic.message}`);
  }
}

function withDiagnostics(html: string, diagnostics: OrviDiagnostic[]): string {
  if (diagnostics.length === 0) return html;
  const panel = `<pre style="background:#fee2e2;border:1px solid #ef4444;color:#7f1d1d;margin:1rem;padding:1rem;white-space:pre-wrap">${diagnostics
    .map((diagnostic) =>
      escapeHtml(`${diagnostic.line}:${diagnostic.column} ${diagnostic.code} ${diagnostic.message}`)
    )
    .join("\n")}</pre>`;
  return html.replace("<body>", `<body>${panel}`);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function assertReadable(path: string): void {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
}

function loadConfig(inputPath: string, configOverride?: string, reload = false): OrviConfig {
  const configPath = configOverride
    ? resolve(configOverride)
    : resolve(dirname(inputPath), "orvi.config.js");
  if (configOverride && !existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  if (!existsSync(configPath)) return {};

  // Loading a project's orvi.config.js requires a dynamic, path-based require.
  // `reload` drops the require cache so `orvi serve` picks up config edits.
  if (reload) {
    try {
      delete require.cache[require.resolve(configPath)];
    } catch {
      // ignore — fall through to a normal require
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded = require(configPath) as unknown;
  if (loaded === null || typeof loaded !== "object") {
    throw new Error(`Config file must export an object: ${configPath}`);
  }
  const withDefault = loaded as { default?: OrviConfig };
  if ("default" in withDefault && withDefault.default) return withDefault.default;
  return loaded;
}

function defaultOutputPath(inputPath: string): string {
  const extension = extname(inputPath);
  return extension ? inputPath.slice(0, -extension.length) + ".html" : `${inputPath}.html`;
}

// True when two paths refer to the same file. Identical strings short-circuit;
// otherwise compare device + inode so case-insensitive filesystems, symlinks,
// and hardlinks are caught. A path that does not exist can never collide.
function isSameFile(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    const statA = statSync(a);
    const statB = statSync(b);
    return statA.dev === statB.dev && statA.ino === statB.ino;
  } catch {
    return false;
  }
}

// Expand `--flag=value` / `-o=value` into separate `--flag` `value` tokens. Only
// `-`-prefixed tokens are split, and only on the first `=`, so positional values
// that contain `=` are left intact.
function splitInlineValues(values: string[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    const equals = value.startsWith("-") ? value.indexOf("=") : -1;
    if (equals > 0) {
      result.push(value.slice(0, equals), value.slice(equals + 1));
    } else {
      result.push(value);
    }
  }
  return result;
}

function cliVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function help(): void {
  console.log(`Orvi CLI ${cliVersion()}

Usage:
  orvi build <input.ov> [-o output.html] [--config orvi.config.js]
  orvi view <input.ov> [--no-open] [--config orvi.config.js]   build to a temp file and open it
  orvi serve <input.ov> [--port 4173] [--config orvi.config.js] live preview with hot reload
  orvi check <input.ov> [--json]
  orvi format <input.ov> [--write] [--check]
  orvi version
  orvi help`);
}
