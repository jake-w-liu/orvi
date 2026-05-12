import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { get } from "http";
import { tmpdir } from "os";
import { join } from "path";
import { ChildProcessWithoutNullStreams, spawn, spawnSync } from "child_process";
import { renderOrvi } from "../src/renderer";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser"
].filter(Boolean) as string[];

describe("installed browser launch smoke", () => {
  it("renders generated Orvi HTML in headless Chrome when installed", async () => {
    const chrome = findChrome();
    if (!chrome) {
      console.warn("Skipping Chrome smoke test; Chrome executable not found.");
      return;
    }
    if (typeof (globalThis as { WebSocket?: unknown }).WebSocket !== "function") {
      console.warn("Skipping Chrome smoke test; global WebSocket is unavailable (Node < 21).");
      return;
    }

    const workspace = mkdtempSync(join(tmpdir(), "orvi-chrome-"));
    try {
      const htmlPath = join(workspace, "fixture.html");
      const profilePath = join(workspace, "profile");
      const html = renderOrvi(
        `---
orvi: 0.1
title: Chrome Fixture
lang: en
dir: ltr
---

# Chrome Smoke

[callout type=success]
  Rendered by Chrome.
[/callout]`,
        { fullDocument: true, colorScheme: "dark" }
      ).html;
      writeFileSync(htmlPath, html);

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
        `file://${htmlPath}`
      ]);

      try {
        const devTools = await waitForDevToolsEndpoint(chromeProcess);
        const version = await getJson<{ Browser?: string }>(`http://127.0.0.1:${devTools.port}/json/version`);
        expect(version.Browser).toContain("Chrome");

        const target = await pollForPageTarget(devTools.port, `file://${htmlPath}`);
        const documentState = await pollForDocumentState<{
          readyState: string;
          url: string;
          title: string;
          heading: string | null;
          body: string;
        }>(
          target.webSocketDebuggerUrl,
          `({
            readyState: document.readyState,
            url: location.href,
            title: document.title,
            heading: document.querySelector("h1")?.textContent ?? null,
            body: document.body?.textContent ?? ""
          })`,
          (state) => state.readyState === "complete" && state.title === "Chrome Fixture"
        );
        expect(documentState.title).toBe("Chrome Fixture");
        expect(documentState.heading).toBe("Chrome Smoke");
        expect(documentState.body).toContain("Rendered by Chrome.");
      } finally {
        await stopProcess(chromeProcess);
      }
    } finally {
      removeTempWorkspace(workspace);
    }
  }, 20000);
});

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

async function pollForDocumentState<T>(
  webSocketDebuggerUrl: string,
  expression: string,
  isReady: (state: T) => boolean
): Promise<T> {
  const deadline = Date.now() + 10000;
  let lastState: T | undefined;

  while (Date.now() < deadline) {
    lastState = await evaluateInTarget<T>(webSocketDebuggerUrl, expression);
    if (isReady(lastState)) return lastState;
    await delay(100);
  }

  throw new Error(`Timed out waiting for Chrome document state: ${JSON.stringify(lastState)}`);
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

function removeTempWorkspace(workspace: string): void {
  // Chrome's sandbox/zygote helpers can keep writing into the profile dir for a
  // moment after the main process exits, racing the cleanup. A failed temp-dir
  // removal is not a test failure — the OS reaps /tmp anyway.
  try {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (cleanupError) {
    console.warn(
      `Could not remove temp workspace ${workspace}: ${
        cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
      }`
    );
  }
}
