import { renderLux } from "../src/renderer";

describe("renderLux", () => {
  it("renders escaped semantic HTML with Lux classes", () => {
    const result = renderLux(`# Hi <script>

[red bold] Important []

[card bg=blue]
  **Safe <b>bold</b>**
[/card]

btn: Docs -> https://example.com`);

    expect(result.ast.diagnostics).toEqual([]);
    expect(result.html).toContain("<h1>Hi &lt;script&gt;</h1>");
    expect(result.html).toContain('class="lux-text-red lux-font-bold"');
    expect(result.html).toContain('class="lux-card lux-bg-blue"');
    expect(result.html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(result.html).toContain('href="https://example.com"');
  });

  it("renders grids and CSS-only tabs", () => {
    const result = renderLux(`[grid 2]
left
---
right
[/grid]

[tabs]
  [tab label=One]
    First
  [/tab]
  [tab label=Two]
    Second
  [/tab]
[/tabs]`);

    expect(result.ast.diagnostics).toEqual([]);
    expect(result.html).toContain("lux-grid lux-grid-2");
    expect(result.html).toContain('type="radio"');
    expect(result.html).toContain("lux-tab-panel");
  });

  it("renders tabs with ARIA relationships", () => {
    const result = renderLux(`[tabs]
  [tab label=One]
    First
  [/tab]
  [tab label=Two]
    Second
  [/tab]
[/tabs]`);

    expect(result.html).toContain('role="tablist"');
    expect(result.html).toContain(
      'id="lux-tabs-0-0-tab" role="tab" for="lux-tabs-0-0" aria-selected="true" aria-controls="lux-tabs-0-0-panel"'
    );
    expect(result.html).toContain(
      'id="lux-tabs-0-0-panel" role="tabpanel" aria-labelledby="lux-tabs-0-0-tab"'
    );
    expect(result.html).toContain(
      'id="lux-tabs-0-1-tab" role="tab" for="lux-tabs-0-1" aria-selected="false" aria-controls="lux-tabs-0-1-panel"'
    );
  });

  it("renders callouts with a useful role and label", () => {
    const result = renderLux(`[callout type=warning]
Heads up
[/callout]`);

    expect(result.html).toContain('class="lux-callout lux-callout-warning"');
    expect(result.html).toContain('role="note"');
    expect(result.html).toContain('aria-label="Warning callout"');
  });

  it("sanitizes unsafe URLs", () => {
    const result = renderLux("btn: Bad -> javascript:alert(1)");
    expect(result.html).toContain('href="#"');
  });

  it("can emit a full HTML document with base CSS", () => {
    const result = renderLux("# Full", {
      fullDocument: true,
      title: "Doc",
      theme: { colors: { blue: "#0f766e" }, radius: "0.25rem" }
    });
    expect(result.html).toContain("<!doctype html>");
    expect(result.html).toContain("<title>Doc</title>");
    expect(result.html).toContain(".lux-document");
    expect(result.html).toContain("--lux-blue: #0f766e;");
    expect(result.html).toContain("--lux-radius: 0.25rem;");
  });

  it("can emit full document language and direction attributes", () => {
    const result = renderLux("# Bonjour", {
      fullDocument: true,
      lang: "fr",
      dir: "rtl"
    });

    expect(result.html).toContain('<html lang="fr" dir="rtl">');
  });

  it("uses document metadata for full document title, language, and direction", () => {
    const result = renderLux(`---
lux: 0.1
title: Metadata Title
lang: ar
dir: rtl
---

# Body`, {
      fullDocument: true
    });

    expect(result.ast.diagnostics).toEqual([]);
    expect(result.html).toContain('<html lang="ar" dir="rtl">');
    expect(result.html).toContain("<title>Metadata Title</title>");
  });

  it("uses fallback title only when options and metadata do not provide one", () => {
    const result = renderLux("# Body", {
      fullDocument: true,
      fallbackTitle: "Fallback"
    });

    expect(result.html).toContain("<title>Fallback</title>");
  });

  it("can emit dark mode output and CSS tokens", () => {
    const result = renderLux("# Dark", {
      fullDocument: true,
      colorScheme: "dark"
    });

    expect(result.html).toContain('<html lang="en" class="lux-theme-dark">');
    expect(result.html).toContain('<main class="lux-document lux-theme-dark">');
    expect(result.html).toContain(".lux-theme-dark {");
    expect(result.html).toContain("color-scheme: dark;");
    expect(result.html).toContain("--lux-surface: #111827;");
  });
});
