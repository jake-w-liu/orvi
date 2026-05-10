import { ComponentNode } from "../src/ast";
import { parseLux } from "../src/parser";

describe("parseLux", () => {
  it("parses the guide example into structured blocks", () => {
    const ast = parseLux(`# Welcome to Lux

[blue bold] A new way to write beautiful documents. []

---

[grid 2]
  ## Why Lux?
  Simple syntax that compiles to rich HTML.
  ---
  ## Who is it for?
  AI systems.
[/grid]

[callout type=info]
  Lux is early.
[/callout]

btn: Get Started -> https://lux-lang.dev`);

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
    const ast = parseLux(`img: ./photo.jpg | A sunset
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

  it("returns diagnostics instead of throwing for invalid syntax", () => {
    const ast = parseLux(`[grid 3]
one
---
two
[/grid]

[chart]
bad
[]

img: ./photo.jpg`);

    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["LUX_GRID_MISMATCH", "LUX_UNKNOWN_COMPONENT", "LUX_INVALID_SEMANTIC"])
    );
  });

  it("reports unclosed blocks and scopes", () => {
    const ast = parseLux(`[callout]
Missing close

[red] Missing inline close`);

    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["LUX_UNCLOSED_BLOCK", "LUX_UNCLOSED_SCOPE"])
    );
  });

  it("validates strict table width and tabs structure", () => {
    const ast = parseLux(`| Name | Role |
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
      expect.arrayContaining(["LUX_TABLE_WIDTH_MISMATCH", "LUX_INVALID_TABS_CHILD", "LUX_INVALID_TAB"])
    );
  });

  it("rejects unknown component options and arguments", () => {
    const ast = parseLux(`[callout loud type=warning tone=soft]
  Bad options.
[/callout]`);

    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["LUX_UNEXPECTED_ARGUMENT", "LUX_UNKNOWN_OPTION"])
    );
  });

  it("reports unknown components inside grids without swallowing separators", () => {
    const ast = parseLux(`[grid 2]
[chart]
---
right
[/grid]`);

    const grid = ast.children[0] as ComponentNode;
    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining(["LUX_UNKNOWN_COMPONENT"]));
    expect(grid.columns).toHaveLength(2);
  });

  it("parses top-level metadata and rejects unsupported versions", () => {
    const ast = parseLux(`---
lux: 9.9
title: Test Doc
lang: en-US
dir: rtl
unknown: keep future-proof
---

# Title`);

    expect(ast.metadata).toEqual({
      lux: "9.9",
      title: "Test Doc",
      lang: "en-US",
      dir: "rtl"
    });
    expect(ast.children[0]).toMatchObject({ type: "heading" });
    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["LUX_UNSUPPORTED_VERSION", "LUX_UNKNOWN_METADATA"])
    );
  });

  it("enforces max component nesting depth", () => {
    const ast = parseLux(
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
      expect.arrayContaining(["LUX_MAX_NESTING_DEPTH"])
    );
  });

  it("rejects dynamic content expressions outside code blocks", () => {
    const ast = parseLux(`Hello {name}

\`\`\`txt
Hello {name}
\`\`\``);

    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["LUX_DYNAMIC_CONTENT_UNSUPPORTED"]);
  });
});
