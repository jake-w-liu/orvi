import { mkdtempSync, rmSync, writeFileSync } from "fs";
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

      const result = spawnSync(firefox, ["--headless", "--screenshot", `file://${htmlPath}`], {
        encoding: "buffer",
        timeout: 15000
      });
      const stderr = result.stderr?.toString("utf8") ?? "";

      expect(result.status).toBe(0);
      expect(stderr).toContain("headless mode");
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
