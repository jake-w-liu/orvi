import { ComponentNode } from "../src/ast";
import { parseOrvi } from "../src/parser";

describe("parseOrvi", () => {
  it("parses the guide example into structured blocks", () => {
    const ast = parseOrvi(`# Welcome to Orvi

[blue bold] A new way to write beautiful documents. []

---

[grid 2]
  ## Why Orvi?
  Simple syntax that compiles to rich HTML.
  ---
  ## Who is it for?
  AI systems.
[/grid]

[callout type=info]
  Orvi is early.
[/callout]

btn: Get Started -> https://github.com/jake-w-liu/orvi`);

    expect(ast.diagnostics).toEqual([]);
    expect(ast.children.map((node) => node.type)).toEqual([
      "heading",
      "paragraph",
      "thematicBreak",
      "component",
      "component",
      "semantic"
    ]);

    const grid = ast.children[3] as ComponentNode;
    expect(grid.name).toBe("grid");
    expect(grid.columns).toHaveLength(2);
    expect(grid.columns?.[0][0]).toMatchObject({ type: "heading", depth: 2 });
  });

  it("parses semantic elements, code fences, tables, and lists", () => {
    const ast = parseOrvi(`img: ./photo.jpg | A sunset
badge: Beta | type=warning

\`\`\`ts | app.ts
const value = "<safe>";
\`\`\`

| Name | Role |
| --- | --- |
| Ada | Dev |

- first
- **second**`);

    expect(ast.diagnostics).toEqual([]);
    expect(ast.children.map((node) => node.type)).toEqual(["semantic", "semantic", "code", "table", "list"]);
  });

  it("recognizes single-column tables when the divider width matches the header", () => {
    const ast = parseOrvi(`| Item |
| --- |
| First |
| Second |`);

    expect(ast.diagnostics).toEqual([]);
    expect(ast.children).toHaveLength(1);
    expect(ast.children[0]).toMatchObject({ type: "table" });
  });

  it("does not treat a thematic break after a pipe-containing paragraph as a table", () => {
    const ast = parseOrvi(`alpha | beta
---
gamma`);

    expect(ast.diagnostics).toEqual([]);
    expect(ast.children.map((node) => node.type)).toEqual(["paragraph", "thematicBreak", "paragraph"]);
  });

  it("returns diagnostics instead of throwing for invalid syntax", () => {
    const ast = parseOrvi(`[grid 3]
one
---
two
[/grid]

[chart]
bad
[]

img: ./photo.jpg`);

    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["ORVI_GRID_MISMATCH", "ORVI_UNKNOWN_COMPONENT", "ORVI_INVALID_SEMANTIC"])
    );
  });

  it("reports unclosed blocks and scopes", () => {
    const ast = parseOrvi(`[callout]
Missing close

[red] Missing inline close`);

    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["ORVI_UNCLOSED_BLOCK", "ORVI_UNCLOSED_SCOPE"])
    );
  });

  it("validates strict table width and tabs structure", () => {
    const ast = parseOrvi(`| Name | Role |
| --- | --- |
| Ada |

[tabs]
  Intro text.
  [tab label=One]
    Good.
  [/tab]
[/tabs]

[tab label=Loose]
  Bad.
[/tab]`);

    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["ORVI_TABLE_WIDTH_MISMATCH", "ORVI_INVALID_TABS_CHILD", "ORVI_INVALID_TAB"])
    );
  });

  it("rejects unknown component options and arguments", () => {
    const ast = parseOrvi(`[callout loud type=warning tone=soft]
  Bad options.
[/callout]`);

    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["ORVI_UNEXPECTED_ARGUMENT", "ORVI_UNKNOWN_OPTION"])
    );
  });

  it("reports unknown components inside grids without swallowing separators", () => {
    const ast = parseOrvi(`[grid 2]
[chart]
---
right
[/grid]`);

    const grid = ast.children[0] as ComponentNode;
    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining(["ORVI_UNKNOWN_COMPONENT"]));
    expect(grid.columns).toHaveLength(2);
  });

  it("parses top-level metadata and rejects unsupported versions", () => {
    const ast = parseOrvi(`---
orvi: 9.9
title: Test Doc
lang: en-US
dir: rtl
unknown: keep future-proof
---

# Title`);

    expect(ast.metadata).toEqual({
      orvi: "9.9",
      title: "Test Doc",
      lang: "en-US",
      dir: "rtl"
    });
    expect(ast.children[0]).toMatchObject({ type: "heading" });
    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["ORVI_UNSUPPORTED_VERSION", "ORVI_UNKNOWN_METADATA"])
    );
  });

  it("enforces max component nesting depth", () => {
    const ast = parseOrvi(
      `[card]
[card]
[card]
too deep
[/card]
[/card]
[/card]`,
      { maxNestingDepth: 2 }
    );

    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["ORVI_MAX_NESTING_DEPTH"])
    );
  });

  it("rejects dynamic content expressions outside code blocks", () => {
    const ast = parseOrvi(`Hello {name}

\`\`\`txt
Hello {name}
\`\`\``);

    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["ORVI_DYNAMIC_CONTENT_UNSUPPORTED"]);
  });

  it("includes editor-friendly diagnostic ranges", () => {
    const ast = parseOrvi("Hello {name}");

    expect(ast.diagnostics[0]).toMatchObject({
      line: 1,
      column: 7,
      endLine: 1,
      endColumn: 13
    });
  });

  it("treats non-modifier brackets in inline text as plain text", () => {
    const ast = parseOrvi("See item [42] here.");

    expect(ast.diagnostics).toEqual([]);
    const paragraph = ast.children[0] as { children: { type: string; value: string }[] };
    expect(paragraph.children.every((child) => child.type === "text")).toBe(true);
    expect(paragraph.children.map((child) => child.value).join("")).toBe("See item [42] here.");
  });

  it("still flags invalid modifiers when an inline scope close follows", () => {
    const ast = parseOrvi("Have [bogus]X[] here.");

    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["ORVI_INVALID_MODIFIER"])
    );
  });

  it("parses quoted option values with whitespace and strips quotes", () => {
    const ast = parseOrvi(`[tabs]
  [tab label="My Tab"]
    body
  [/tab]
[/tabs]`);

    expect(ast.diagnostics).toEqual([]);
    const tabs = ast.children[0] as ComponentNode;
    const tab = tabs.children[0] as ComponentNode;
    expect(tab.options).toEqual({ label: "My Tab" });
  });

  it("strips quotes from simple option values", () => {
    const ast = parseOrvi(`[callout type="success"]
  Done.
[/callout]`);

    expect(ast.diagnostics).toEqual([]);
    expect((ast.children[0] as ComponentNode).options).toEqual({ type: "success" });
  });

  it("does not treat intraword underscores as emphasis", () => {
    const ast = parseOrvi("Use snake_case_var here.");

    const paragraph = ast.children[0] as { children: { type: string }[] };
    expect(paragraph.children.every((child) => child.type === "text")).toBe(true);
  });

  it("still emphasizes underscore-delimited tokens at word boundaries", () => {
    const ast = parseOrvi("text _emph_ end");

    const paragraph = ast.children[0] as { children: { type: string }[] };
    expect(paragraph.children.some((child) => child.type === "emphasis")).toBe(true);
  });

  it("reports dynamic content diagnostics on the originating line", () => {
    const ast = parseOrvi("first line\nsecond {x} line");

    expect(ast.diagnostics).toEqual([
      expect.objectContaining({
        code: "ORVI_DYNAMIC_CONTENT_UNSUPPORTED",
        line: 2,
        column: 8,
        endLine: 2,
        endColumn: 11
      })
    ]);
  });
});
