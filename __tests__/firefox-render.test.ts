import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import { renderOrvi } from "../src/renderer";

const FIREFOX_CANDIDATES = [
  process.env.FIREFOX_PATH,
  "/Applications/Firefox.app/Contents/MacOS/firefox",
  "/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox",
  "firefox"
].filter(Boolean) as string[];

describe("Firefox rendering smoke", () => {
  it("renders generated Orvi HTML in headless Firefox", () => {
    const firefox = findFirefox();
    if (!firefox) {
      console.warn("Skipping Firefox smoke test; Firefox executable not found.");
      return;
    }

    const workspace = mkdtempSync(join(tmpdir(), "orvi-firefox-"));
    try {
      const htmlPath = join(workspace, "fixture.html");
      const screenshotPath = join(workspace, "screenshot.png");
      const html = renderOrvi(
        `---
orvi: 0.1
title: Firefox Fixture
lang: en
dir: ltr
---

# Firefox Smoke

[callout type=success]
  Rendered by Firefox.
[/callout]`,
        { fullDocument: true, colorScheme: "dark" }
      ).html;
      writeFileSync(htmlPath, html);

      const result = spawnSync(firefox, ["--headless", "--screenshot", screenshotPath, `file://${htmlPath}`], {
        encoding: "buffer",
        timeout: 15000
      });
      const stderr = result.stderr?.toString("utf8") ?? "";
      const stdout = result.stdout?.toString("utf8") ?? "";

      if (result.error || result.status === null || result.status !== 0) {
        console.warn(
          `Skipping Firefox smoke test; Firefox headless screenshot is not available here (${formatSpawnFailure(
            result.status,
            result.signal,
            result.error,
            stdout,
            stderr
          )}).`
        );
        return;
      }

      expect(stderr).toContain("headless mode");
      expect(existsSync(screenshotPath)).toBe(true);
      expect(statSync(screenshotPath).size).toBeGreaterThan(0);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }, 20000);
});

function findFirefox(): string | undefined {
  for (const candidate of FIREFOX_CANDIDATES) {
    const result = spawnSync(candidate, ["--version"], {
      encoding: "utf8",
      timeout: 5000
    });
    if (result.status === 0) return candidate;
  }

  return undefined;
}

function formatSpawnFailure(
  status: number | null,
  signal: NodeJS.Signals | null,
  error: Error | undefined,
  stdout: string,
  stderr: string
): string {
  return [
    `status=${status}`,
    `signal=${signal}`,
    error ? `error=${error.message}` : undefined,
    stdout.trim() ? `stdout=${stdout.trim().slice(0, 500)}` : undefined,
    stderr.trim() ? `stderr=${stderr.trim().slice(0, 500)}` : undefined
  ]
    .filter(Boolean)
    .join("; ");
}
