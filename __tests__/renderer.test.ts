import { renderOrvi, renderToHtml } from "../src/renderer";
import type { DocumentNode, HeadingNode, InlineModifier } from "../src/ast";

const LOC = { line: 1, column: 1 };
function doc(children: DocumentNode["children"]): DocumentNode {
  return { type: "document", loc: LOC, metadata: {}, children, diagnostics: [] };
}
function heading(depth: number): HeadingNode {
  return { type: "heading", loc: LOC, depth, children: [{ type: "text", loc: LOC, value: "x" }] };
}

describe("renderOrvi", () => {
  it("renders escaped semantic HTML with Orvi classes", () => {
    const result = renderOrvi(`# Hi <script>

[red bold] Important []

[card bg=blue]
  **Safe <b>bold</b>**
[/card]

btn: Docs -> https://example.com`);

    expect(result.ast.diagnostics).toEqual([]);
    expect(result.html).toContain("<h1>Hi &lt;script&gt;</h1>");
    expect(result.html).toContain('class="orvi-text-red orvi-font-bold"');
    expect(result.html).toContain('class="orvi-card orvi-bg-blue"');
    expect(result.html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(result.html).toContain('href="https://example.com"');
  });

  it("renders grids and CSS-only tabs", () => {
    const result = renderOrvi(`[grid 2]
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
    expect(result.html).toContain("orvi-grid orvi-grid-2");
    expect(result.html).toContain('type="radio"');
    expect(result.html).toContain("orvi-tab-panel");
  });

  it("renders tabs with ARIA relationships", () => {
    const result = renderOrvi(`[tabs]
  [tab label=One]
    First
  [/tab]
  [tab label=Two]
    Second
  [/tab]
[/tabs]`);

    expect(result.html).toContain('role="tablist"');
    expect(result.html).toContain(
      'id="orvi-tabs-0-0-tab" role="tab" for="orvi-tabs-0-0" aria-selected="true" aria-controls="orvi-tabs-0-0-panel"'
    );
    expect(result.html).toContain(
      'id="orvi-tabs-0-0-panel" role="tabpanel" aria-labelledby="orvi-tabs-0-0-tab"'
    );
    expect(result.html).toContain(
      'id="orvi-tabs-0-1-tab" role="tab" for="orvi-tabs-0-1" aria-selected="false" aria-controls="orvi-tabs-0-1-panel"'
    );
  });

  it("renders callouts with a useful role and label", () => {
    const result = renderOrvi(`[callout type=warning]
Heads up
[/callout]`);

    expect(result.html).toContain('class="orvi-callout orvi-callout-warning"');
    expect(result.html).toContain('role="note"');
    expect(result.html).toContain('aria-label="Warning callout"');
  });

  it("sanitizes unsafe URLs", () => {
    const result = renderOrvi("btn: Bad -> javascript:alert(1)");
    expect(result.html).toContain('href="#"');
  });

  it("sanitizes obfuscated unsafe URL schemes", () => {
    const tabbedScheme = renderOrvi("btn: Bad -> java\tscript:alert(1)");
    const unknownScheme = renderOrvi("btn: Bad -> webcal://example.com/event");

    expect(tabbedScheme.html).toContain('href="#"');
    expect(unknownScheme.html).toContain('href="#"');
  });

  it("can emit a full HTML document with base CSS", () => {
    const result = renderOrvi("# Full", {
      fullDocument: true,
      title: "Doc",
      theme: { colors: { blue: "#0f766e" }, radius: "0.25rem" }
    });
    expect(result.html).toContain("<!doctype html>");
    expect(result.html).toContain("<title>Doc</title>");
    expect(result.html).toContain(".orvi-document");
    expect(result.html).toContain("--orvi-blue: #0f766e;");
    expect(result.html).toContain("--orvi-radius: 0.25rem;");
  });

  it("drops unsafe runtime theme declarations", () => {
    const result = renderOrvi("# Safe", {
      fullDocument: true,
      theme: {
        colors: {
          blue: "#0f766e",
          ["bad: red;}</style><script>alert(1)</script><style>"]: "red"
        } as Record<string, string>,
        radius: "0.25rem;</style><script>alert(1)</script>"
      }
    });

    expect(result.html).toContain("--orvi-blue: #0f766e;");
    expect(result.html).not.toContain("bad: red");
    expect(result.html).not.toContain("alert(1)");
  });

  it("prevents extra CSS from closing the generated style tag", () => {
    const result = renderOrvi("# Safe", {
      fullDocument: true,
      extraCss: "</style><script>alert(1)</script>"
    });

    expect(result.html).toContain("<\\/style><script>alert(1)</script>");
    expect(result.html).not.toContain("</style><script>");
  });

  it("can emit full document language and direction attributes", () => {
    const result = renderOrvi("# Bonjour", {
      fullDocument: true,
      lang: "fr",
      dir: "rtl"
    });

    expect(result.html).toContain('<html lang="fr" dir="rtl">');
  });

  it("ignores invalid runtime direction values", () => {
    const result = renderOrvi("# Safe", {
      fullDocument: true,
      dir: 'ltr" onload="alert(1)' as "ltr"
    });

    expect(result.html).toContain('<html lang="en">');
    expect(result.html).not.toContain("onload=");
  });

  it("uses document metadata for full document title, language, and direction", () => {
    const result = renderOrvi(`---
orvi: 0.1
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
    const result = renderOrvi("# Body", {
      fullDocument: true,
      fallbackTitle: "Fallback"
    });

    expect(result.html).toContain("<title>Fallback</title>");
  });

  it("can emit dark mode output and CSS tokens", () => {
    const result = renderOrvi("# Dark", {
      fullDocument: true,
      colorScheme: "dark"
    });

    expect(result.html).toContain('<html lang="en" class="orvi-theme-dark">');
    expect(result.html).toContain('<main class="orvi-document orvi-theme-dark">');
    expect(result.html).toContain(".orvi-theme-dark {");
    expect(result.html).toContain("color-scheme: dark;");
    expect(result.html).toContain("--orvi-surface: #111827;");
  });
});

describe("renderToHtml is robust to malformed/hostile input", () => {
  it("clamps heading depth to 1..6 so the output is always valid HTML", () => {
    const html = renderToHtml(doc([heading(0), heading(1), heading(3), heading(99), heading(2.7), heading(NaN)]));
    expect(html).toContain("<h1>");
    expect(html).toContain("<h3>");
    expect(html).toContain("<h6>");
    expect(html).not.toMatch(/<h(?:0|7|99|2\.7|NaN)\b/);
  });

  it("escapes a hostile inline-modifier value instead of letting it break out of the class attribute", () => {
    const modifiers: InlineModifier[] = [{ kind: "color", value: '"><script>alert(1)</script>' }];
    const html = renderToHtml(
      doc([{ type: "paragraph", loc: LOC, children: [{ type: "scope", loc: LOC, modifiers, children: [{ type: "text", loc: LOC, value: "x" }] }] }])
    );
    expect(html).not.toMatch(/<script\b/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("does not throw on a partially malformed AST (null/undefined children)", () => {
    const malformed = {
      type: "document",
      loc: LOC,
      metadata: {},
      diagnostics: [],
      children: [
        { type: "paragraph", loc: LOC, children: null },
        { type: "heading", loc: LOC, depth: 1, children: undefined },
        { type: "component", loc: LOC, name: "callout", options: null, children: null },
        { type: "list", loc: LOC, ordered: false, items: null },
        { type: "table", loc: LOC, headers: null, rows: null }
      ]
    } as unknown as DocumentNode;
    expect(() => renderToHtml(malformed, { fullDocument: true })).not.toThrow();
  });
});
