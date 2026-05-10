import { ChildProcessWithoutNullStreams, spawn, spawnSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { get } from "http";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import * as React from "react";
import { ReactLuxFixtureApp } from "../fixtures/react-browser/app";
import { defaultCss } from "../src/renderer";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser"
].filter(Boolean) as string[];

describe("React fixture browser smoke", () => {
  it("renders the exported React renderer in a fixture and inspects the result", async () => {
    const diagnostics: unknown[] = [];
    const fixtureHtml = renderReactElement(
      React.createElement(ReactLuxFixtureApp, {
        onDiagnostics: (items) => diagnostics.push(...items)
      })
    );

    expect(diagnostics).toEqual([]);
    expect(fixtureHtml).toContain('data-fixture="react-browser"');
    expect(fixtureHtml).toContain('class="lux-react-root fixture-renderer"');
    expect(fixtureHtml).toContain("<h1>React Fixture</h1>");
    expect(fixtureHtml).toContain('role="note"');
    expect(fixtureHtml).toContain("Exported React renderer mounted this Lux document.");
    expect(fixtureHtml).toContain("lux-grid lux-grid-2");
    expect(fixtureHtml).toContain("lux-text-green lux-font-bold");

    const chrome = findChrome();
    if (!chrome) {
      console.warn("Skipping React fixture browser smoke; Chrome executable not found.");
      return;
    }

    const workspace = mkdtempSync(join(tmpdir(), "lux-react-fixture-"));
    try {
      const htmlPath = join(workspace, "react-fixture.html");
      const profilePath = join(workspace, "profile");
      const htmlUrl = pathToFileURL(htmlPath).href;
      writeFileSync(htmlPath, wrapFixtureDocument(fixtureHtml));

      const chromeProcess = spawn(chrome, [
        "--headless=new",
        "--disable-gpu",
        "--disable-background-networking",
        "--disable-component-extensions-with-background-pages",
        "--disable-extensions",
        "--no-first-run",
        "--no-default-browser-check",
        "--remote-debugging-port=0",
        `--user-data-dir=${profilePath}`,
        htmlUrl
      ]);

      try {
        const devTools = await waitForDevToolsEndpoint(chromeProcess);
        const target = await pollForPageTarget(devTools.port, htmlUrl);
        const documentState = await evaluateInTarget<{
          title: string;
          fixture: string | null;
          renderedHeading: string | null;
          diagnosticCount: string | null;
          calloutLabel: string | null;
          gridColumns: number;
          readyText: string | null;
          linkHref: string | null;
          body: string;
        }>(
          target.webSocketDebuggerUrl,
          `({
            title: document.title,
            fixture: document.querySelector("[data-fixture]")?.getAttribute("data-fixture") ?? null,
            renderedHeading: document.querySelector(".lux-react-root .lux-document h1")?.textContent ?? null,
            diagnosticCount: document.querySelector(".lux-react-root")?.getAttribute("data-lux-diagnostics") ?? null,
            calloutLabel: document.querySelector(".lux-callout")?.getAttribute("aria-label") ?? null,
            gridColumns: document.querySelectorAll(".lux-grid-column").length,
            readyText: document.querySelector(".lux-text-green.lux-font-bold")?.textContent?.trim() ?? null,
            linkHref: document.querySelector(".lux-btn")?.getAttribute("href") ?? null,
            body: document.body?.textContent ?? ""
          })`
        );

        expect(documentState.title).toBe("Lux React Fixture");
        expect(documentState.fixture).toBe("react-browser");
        expect(documentState.renderedHeading).toBe("React Fixture");
        expect(documentState.diagnosticCount).toBe("0");
        expect(documentState.calloutLabel).toBe("Success callout");
        expect(documentState.gridColumns).toBe(2);
        expect(documentState.readyText).toBe("Ready");
        expect(documentState.linkHref).toBe("https://example.com/lux");
        expect(documentState.body).toContain("Browser inspection");
      } finally {
        await stopProcess(chromeProcess);
      }
    } finally {
      rmSync(workspace, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }, 20000);
});

function wrapFixtureDocument(body: string): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Lux React Fixture</title>",
    `<style>${defaultCss}</style>`,
    "</head>",
    "<body>",
    body,
    "</body>",
    "</html>"
  ].join("\n");
}

function renderReactElement(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") {
    return escapeHtml(String(node));
  }
  if (Array.isArray(node)) return node.map(renderReactElement).join("");
  if (!React.isValidElement(node)) return "";

  if (node.type === React.Fragment) {
    return renderReactElement((node.props as { children?: React.ReactNode }).children);
  }

  if (typeof node.type === "function") {
    const Component = node.type as (props: unknown) => React.ReactNode;
    return renderReactElement(Component(node.props));
  }

  if (typeof node.type !== "string") {
    throw new Error(`Unsupported React fixture element type: ${String(node.type)}`);
  }

  const props = node.props as Record<string, unknown> & {
    children?: React.ReactNode;
    dangerouslySetInnerHTML?: { __html: string };
  };
  const attributes = Object.entries(props)
    .filter(([name]) => name !== "children" && name !== "dangerouslySetInnerHTML")
    .map(renderAttribute)
    .filter(Boolean)
    .join("");
  const children = props.dangerouslySetInnerHTML?.__html ?? renderReactElement(props.children);
  return `<${node.type}${attributes}>${children}</${node.type}>`;
}

function renderAttribute([name, value]: [string, unknown]): string {
  if (value === null || value === undefined || typeof value === "function" || value === false) return "";
  const htmlName = name === "className" ? "class" : name === "htmlFor" ? "for" : name;
  if (value === true) return ` ${htmlName}`;
  if (typeof value === "object") {
    throw new Error(`Unsupported React fixture prop "${name}"`);
  }
  return ` ${htmlName}="${escapeAttr(String(value))}"`;
}

function findChrome(): string | undefined {
  for (const candidate of CHROME_CANDIDATES) {
    const result = spawnSync(candidate, ["--version"], {
      encoding: "utf8",
      timeout: 5000
    });
    if (result.status === 0 && result.stdout.includes("Chrome")) return candidate;
  }

  return undefined;
}

function waitForDevToolsEndpoint(
  chromeProcess: ChildProcessWithoutNullStreams
): Promise<{ port: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stderr = "";
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for Chrome DevTools endpoint.\n${stderr}`));
    }, 10000);

    chromeProcess.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    chromeProcess.once("exit", (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited before DevTools was ready: code=${code} signal=${signal}\n${stderr}`));
    });

    chromeProcess.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      const match = stderr.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (match) {
        clearTimeout(timer);
        resolve({ port: Number(match[1]), stderr });
      }
    });
  });
}

async function pollForPageTarget(
  port: number,
  expectedUrl: string
): Promise<{ title: string; url: string; webSocketDebuggerUrl: string }> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const targets = await getJson<Array<{ title: string; type: string; url: string; webSocketDebuggerUrl: string }>>(
      `http://127.0.0.1:${port}/json/list`
    );
    const pageTarget = targets.find((target) => target.type === "page" && target.url === expectedUrl);
    if (pageTarget) return pageTarget;
    await delay(100);
  }

  throw new Error(`Timed out waiting for Chrome to load ${expectedUrl}`);
}

function evaluateInTarget<T>(webSocketDebuggerUrl: string, expression: string): Promise<T> {
  type WebSocketLike = {
    onopen: (() => void) | null;
    onmessage: ((event: { data: unknown }) => void) | null;
    onerror: ((event: unknown) => void) | null;
    close: () => void;
    send: (data: string) => void;
  };

  const WebSocketCtor = (globalThis as unknown as { WebSocket: new (url: string) => WebSocketLike }).WebSocket;

  return new Promise((resolve, reject) => {
    const socket = new WebSocketCtor(webSocketDebuggerUrl);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("Timed out waiting for Chrome Runtime.evaluate response."));
    }, 5000);

    socket.onerror = (event) => {
      clearTimeout(timer);
      reject(event);
    };

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: {
            expression,
            returnByValue: true
          }
        })
      );
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        error?: { message: string };
        result?: { result?: { value?: T } };
      };
      if (message.id !== 1) return;

      clearTimeout(timer);
      socket.close();

      if (message.error) {
        reject(new Error(message.error.message));
        return;
      }

      resolve(message.result?.result?.value as T);
    };
  });
}

function getJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode !== 200) {
          reject(new Error(`GET ${url} returned ${response.statusCode}: ${body}`));
          return;
        }

        try {
          resolve(JSON.parse(body) as T);
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopProcess(chromeProcess: ChildProcessWithoutNullStreams): Promise<void> {
  if (chromeProcess.exitCode !== null) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (chromeProcess.exitCode === null) chromeProcess.kill("SIGKILL");
    }, 5000);

    chromeProcess.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    chromeProcess.kill("SIGTERM");
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
