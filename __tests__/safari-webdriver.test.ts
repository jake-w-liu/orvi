import { ChildProcessWithoutNullStreams, spawn, spawnSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { createServer as createHttpServer, request } from "http";
import { tmpdir } from "os";
import { join } from "path";
import { AddressInfo, createServer as createNetServer } from "net";
import { renderOrvi } from "../src/renderer";

const SAFARIDRIVER_CANDIDATES = [
  process.env.SAFARIDRIVER_PATH,
  "/System/Cryptexes/App/usr/bin/safaridriver",
  "/usr/bin/safaridriver",
  "safaridriver"
].filter(Boolean) as string[];

type WebDriverEnvelope<T> = {
  value?: T | WebDriverError;
  sessionId?: string;
};

type WebDriverError = {
  error: string;
  message: string;
  stacktrace?: string;
};

describe("Safari WebDriver rendering smoke", () => {
  it("renders generated Orvi HTML in Safari when WebDriver automation is enabled", async () => {
    const safaridriver = findSafaridriver();
    if (!safaridriver) {
      console.warn("Skipping Safari WebDriver smoke test; safaridriver executable not found.");
      return;
    }

    const workspace = mkdtempSync(join(tmpdir(), "orvi-safari-"));
    const port = await getAvailablePort();
    const driverProcess = spawn(safaridriver, ["-p", String(port)]);
    let sessionId: string | undefined;
    let fixtureServer: ServedFixture | undefined;

    try {
      await waitForWebDriverStatus(driverProcess, port);

      const htmlPath = join(workspace, "fixture.html");
      const html = renderOrvi(
        `---
orvi: 0.1
title: Safari Fixture
lang: en
dir: ltr
---

# Safari Smoke

[callout type=success]
  Rendered by Safari.
[/callout]`,
        { fullDocument: true, colorScheme: "dark" }
      ).html;
      writeFileSync(htmlPath, html);
      fixtureServer = await serveHtmlFixture(html);

      const session = await webDriverRequest<WebDriverSession>(
        port,
        "POST",
        "/session",
        { capabilities: { alwaysMatch: { browserName: "safari" } } }
      );

      if (isRemoteAutomationDisabled(session)) {
        console.warn(
          "Skipping Safari WebDriver smoke test; enable 'Allow remote automation' in Safari Settings to run it."
        );
        return;
      }

      expectOk(session, "create Safari WebDriver session");
      sessionId = getSessionId(session.body);
      expect(sessionId).toEqual(expect.any(String));

      await expectOkResponse(
        webDriverRequest(port, "POST", `/session/${sessionId}/url`, { url: fixtureServer.url }),
        "navigate Safari to generated Orvi HTML"
      );

      const documentState = await expectOkResponse<DocumentState>(
        webDriverRequest(port, "POST", `/session/${sessionId}/execute/sync`, {
          script: `return {
            title: document.title,
            heading: document.querySelector("h1")?.textContent ?? null,
            body: document.body?.textContent ?? ""
          };`,
          args: []
        }),
        "inspect generated Orvi HTML in Safari"
      );

      expect(documentState.title).toBe("Safari Fixture");
      expect(documentState.heading).toBe("Safari Smoke");
      expect(documentState.body).toContain("Rendered by Safari.");
    } finally {
      if (sessionId) {
        await expectOkResponse(webDriverRequest(port, "DELETE", `/session/${sessionId}`), "delete Safari session");
      }
      if (fixtureServer) await fixtureServer.close();
      await stopProcess(driverProcess);
      rmSync(workspace, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }, 30000);
});

type WebDriverSession = {
  sessionId?: string;
};

type DocumentState = {
  title: string;
  heading: string | null;
  body: string;
};

type WebDriverResponse<T> = {
  statusCode: number;
  body: WebDriverEnvelope<T>;
};

type ServedFixture = {
  url: string;
  close: () => Promise<void>;
};

function findSafaridriver(): string | undefined {
  for (const candidate of SAFARIDRIVER_CANDIDATES) {
    const result = spawnSync(candidate, ["--version"], {
      encoding: "utf8",
      timeout: 5000
    });
    if (result.status === 0 && result.stdout.includes("Safari")) return candidate;
  }

  return undefined;
}

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

function serveHtmlFixture(html: string): Promise<ServedFixture> {
  return new Promise((resolve, reject) => {
    const server = createHttpServer((request, response) => {
      if (request.url !== "/fixture.html") {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-length": Buffer.byteLength(html)
      });
      response.end(html);
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${address.port}/fixture.html`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) closeReject(error);
              else closeResolve();
            });
          })
      });
    });
  });
}

async function waitForWebDriverStatus(
  driverProcess: ChildProcessWithoutNullStreams,
  port: number
): Promise<void> {
  let stderr = "";
  driverProcess.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const exitPromise = new Promise<never>((_, reject) => {
    driverProcess.once("exit", (code, signal) => {
      reject(new Error(`safaridriver exited before /status was ready: code=${code} signal=${signal}\n${stderr}`));
    });
  });

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const probe = webDriverRequest(port, "GET", "/status").catch(() => undefined);
    const result = await Promise.race([probe, exitPromise]);
    if (result?.statusCode === 200) return;
    await delay(100);
  }

  throw new Error(`Timed out waiting for safaridriver /status.\n${stderr}`);
}

function webDriverRequest<T = unknown>(
  port: number,
  method: string,
  path: string,
  body?: unknown
): Promise<WebDriverResponse<T>> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const clientRequest = request(
      {
        method,
        hostname: "127.0.0.1",
        port,
        path,
        timeout: 5000,
        headers: payload
          ? {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(payload)
            }
          : undefined
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          try {
            resolve({
              statusCode: response.statusCode ?? 0,
              body: responseBody ? (JSON.parse(responseBody) as WebDriverEnvelope<T>) : {}
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    clientRequest.on("error", reject);
    clientRequest.on("timeout", () => {
      clientRequest.destroy(new Error(`Timed out during ${method} ${path}`));
    });

    if (payload) clientRequest.write(payload);
    clientRequest.end();
  });
}

function isRemoteAutomationDisabled(response: WebDriverResponse<WebDriverSession>): boolean {
  if (response.statusCode < 400) return false;
  const value = response.body.value;
  return (
    isWebDriverError(value) &&
    value.error === "session not created" &&
    value.message.includes("Allow remote automation")
  );
}

async function expectOkResponse<T>(responsePromise: Promise<WebDriverResponse<T>>, action: string): Promise<T> {
  const response = await responsePromise;
  expectOk(response, action);
  return response.body.value as T;
}

function expectOk<T>(response: WebDriverResponse<T>, action: string): void {
  const value = response.body.value;
  if (response.statusCode >= 400 || isWebDriverError(value)) {
    throw new Error(`Failed to ${action}: ${JSON.stringify(response.body)}`);
  }
}

function getSessionId(body: WebDriverEnvelope<WebDriverSession>): string {
  if (body.sessionId) return body.sessionId;
  const value = body.value;
  if (!isWebDriverError(value) && value?.sessionId) return value.sessionId;
  throw new Error(`Safari WebDriver session id missing: ${JSON.stringify(body)}`);
}

function isWebDriverError(value: unknown): value is WebDriverError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as WebDriverError).error === "string"
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopProcess(driverProcess: ChildProcessWithoutNullStreams): Promise<void> {
  if (driverProcess.exitCode !== null) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (driverProcess.exitCode === null) driverProcess.kill("SIGKILL");
    }, 5000);

    driverProcess.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    driverProcess.kill("SIGTERM");
  });
}
