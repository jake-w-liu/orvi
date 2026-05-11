#!/usr/bin/env node
import { createServer, ServerResponse } from "http";
import { existsSync, readFileSync, watch, writeFileSync } from "fs";
import { basename, dirname, extname, resolve } from "path";
import { defaultCss, OrviColorScheme, OrviDirection, OrviTheme, renderOrvi } from "./renderer";
import { parseOrvi } from "./parser";
import { OrviDiagnostic } from "./ast";
import { formatOrvi } from "./formatter";

interface BuildArgs {
  input: string;
  output?: string;
}

interface ServeArgs {
  input: string;
  port: number;
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

const args = process.argv.slice(2);
const command = args[0];

try {
  if (command === "build") {
    build(parseBuildArgs(args.slice(1)));
  } else if (command === "check") {
    check(parseCheckArgs(args.slice(1)));
  } else if (command === "format") {
    format(parseFormatArgs(args.slice(1)));
  } else if (command === "serve") {
    serve(parseServeArgs(args.slice(1)));
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
  assertReadable(inputPath);
  const config = loadConfig(inputPath);
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

  const outputPath = resolve(options.output ?? defaultOutputPath(inputPath));
  writeFileSync(outputPath, result.html);
  console.log(`Built ${outputPath}`);
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
  const config = loadConfig(inputPath);
  const clients = new Set<ServerResponse>();

  watch(inputPath, { persistent: true }, () => {
    for (const client of clients) {
      client.write("data: reload\n\n");
    }
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
      request.on("close", () => clients.delete(response));
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
  });

  server.listen(options.port, () => {
    console.log(`Orvi preview http://localhost:${options.port}`);
  });
}

function parseBuildArgs(values: string[]): BuildArgs {
  const input = values[0];
  if (!input) throw new Error("Usage: orvi build <input.ov> [-o output.html]");

  let output: string | undefined;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] === "-o" || values[index] === "--output") {
      output = values[index + 1];
      index += 1;
    }
  }

  return { input, output };
}

function parseServeArgs(values: string[]): ServeArgs {
  const input = values[0];
  if (!input) throw new Error("Usage: orvi serve <input.ov> [--port 4173]");

  let port = 4173;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] === "--port" || values[index] === "-p") {
      port = Number(values[index + 1]);
      index += 1;
    }
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port must be an integer from 1 to 65535.");
  }

  return { input, port };
}

function parseCheckArgs(values: string[]): CheckArgs {
  const input = values.find((value) => !value.startsWith("-"));
  if (!input) throw new Error("Usage: orvi check <input.ov> [--json]");

  return {
    input,
    json: values.includes("--json")
  };
}

function parseFormatArgs(values: string[]): FormatArgs {
  const input = values.find((value) => !value.startsWith("-"));
  if (!input) throw new Error("Usage: orvi format <input.ov> [--write] [--check]");

  return {
    input,
    write: values.includes("--write") || values.includes("-w"),
    check: values.includes("--check"),
    json: values.includes("--json")
  };
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

function loadConfig(inputPath: string): OrviConfig {
  const configPath = resolve(dirname(inputPath), "orvi.config.js");
  if (!existsSync(configPath)) return {};

  const loaded = require(configPath) as OrviConfig | { default?: OrviConfig };
  if ("default" in loaded && loaded.default) return loaded.default;
  return loaded as OrviConfig;
}

function defaultOutputPath(inputPath: string): string {
  const extension = extname(inputPath);
  return extension ? inputPath.slice(0, -extension.length) + ".html" : `${inputPath}.html`;
}

function help(): void {
  console.log(`Orvi CLI

Usage:
  orvi build <input.ov> [-o output.html]
  orvi check <input.ov> [--json]
  orvi format <input.ov> [--write] [--check]
  orvi serve <input.ov> [--port 4173]`);
}
