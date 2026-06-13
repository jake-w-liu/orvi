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

  it("keeps pipes inside img alt text and badge labels", () => {
    const ast = parseOrvi(`img: ./diagram.png | Flow: A | B | C
badge: One | Two | type=warning
badge: Plain | Text`);

    expect(ast.diagnostics).toEqual([]);
    expect(ast.children).toEqual([
      expect.objectContaining({ type: "semantic", name: "img", value: "./diagram.png", alt: "Flow: A | B | C" }),
      expect.objectContaining({ type: "semantic", name: "badge", value: "One | Two", options: { type: "warning" } }),
      expect.objectContaining({ type: "semantic", name: "badge", value: "Plain | Text", options: {} })
    ]);
  });

  it("keeps a pipe inside a code-fence filename (B5)", () => {
    // The filename is everything after the FIRST `|`; splitting on every pipe
    // and taking element [1] truncated names that contain a pipe.
    const ast = parseOrvi("```python | src/a|b.py\nx\n```");
    expect(ast.diagnostics).toEqual([]);
    expect(ast.children[0]).toMatchObject({ type: "code", language: "python", filename: "src/a|b.py" });

    // A plain filename (no embedded pipe) is unaffected.
    expect(parseOrvi("```js | app.js\nx\n```").children[0]).toMatchObject({ filename: "app.js" });
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

  it("caps deep block nesting with a diagnostic instead of crashing", () => {
    const deep = "[callout]\n".repeat(2000) + "x\n" + "[/callout]\n".repeat(2000);
    let ast: ReturnType<typeof parseOrvi> | undefined;
    expect(() => {
      ast = parseOrvi(deep);
    }).not.toThrow();
    expect(ast!.diagnostics.some((d) => d.code === "ORVI_MAX_NESTING_DEPTH")).toBe(true);
  });

  it("caps deep inline-scope nesting with a diagnostic instead of crashing", () => {
    const deep = "[red] ".repeat(2000) + "x " + "[] ".repeat(2000);
    let ast: ReturnType<typeof parseOrvi> | undefined;
    expect(() => {
      ast = parseOrvi(deep);
    }).not.toThrow();
    expect(ast!.diagnostics.some((d) => d.code === "ORVI_MAX_NESTING_DEPTH")).toBe(true);
  });

  it("ignores a nonsensical maxNestingDepth option (still caps deep nesting)", () => {
    const deep = "[callout]\n".repeat(2000) + "x\n" + "[/callout]\n".repeat(2000);
    for (const maxNestingDepth of [NaN, Infinity, -1, -7, 2.9] as number[]) {
      let ast: ReturnType<typeof parseOrvi> | undefined;
      expect(() => {
        ast = parseOrvi(deep, { maxNestingDepth });
      }).not.toThrow();
      expect(ast!.diagnostics.some((d) => d.code === "ORVI_MAX_NESTING_DEPTH")).toBe(true);
    }
  });

  it("treats a bare # marker as an empty heading", () => {
    const ast = parseOrvi("#\nfollowing text\n\n### \nmore");
    expect(ast.diagnostics).toEqual([]);
    expect(ast.children.map((node) => node.type)).toEqual(["heading", "paragraph", "heading", "paragraph"]);
    const [h1, , h3] = ast.children as Array<{ depth: number; children: unknown[] }>;
    expect(h1).toMatchObject({ depth: 1 });
    expect(h1.children).toEqual([]);
    expect(h3).toMatchObject({ depth: 3 });
    expect(h3.children).toEqual([]);
  });

  it("treats a bare list marker as an empty list item", () => {
    const ast = parseOrvi("- a\n-\n* b\n*\n1.\n2. c");
    expect(ast.diagnostics).toEqual([]);
    expect(ast.children.map((node) => node.type)).toEqual(["list", "list"]);
    const [unordered, ordered] = ast.children as Array<{ ordered: boolean; items: Array<{ children: unknown[] }> }>;
    expect(unordered).toMatchObject({ ordered: false });
    expect(unordered.items.map((i) => i.children.length)).toEqual([1, 0, 1, 0]); // "a", empty, "b", empty
    expect(ordered).toMatchObject({ ordered: true });
    expect(ordered.items.map((i) => i.children.length)).toEqual([0, 1]); // empty, "c"
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

  it("reports an unclosed metadata block but still keeps the entries and following blocks", () => {
    const ast = parseOrvi(`---
orvi: 0.1
title: Doc

# Heading`);

    expect(ast.metadata).toEqual({ orvi: "0.1", title: "Doc" });
    expect(ast.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["ORVI_UNCLOSED_METADATA"]);
    expect(ast.children.map((node) => node.type)).toEqual(["heading"]);
  });

  it("treats a leading thematic break that is not followed by metadata entries as content", () => {
    const ast = parseOrvi(`---
just some prose here
---`);

    expect(ast.metadata).toEqual({});
    expect(ast.diagnostics).toEqual([]);
    expect(ast.children.map((node) => node.type)).toEqual(["thematicBreak", "paragraph", "thematicBreak"]);
  });

  it("splits btn on the first arrow and preserves spaces in the target", () => {
    const ast = parseOrvi("btn: Step 1 -> Step 2 -> /done");

    expect(ast.diagnostics).toEqual([]);
    expect(ast.children[0]).toMatchObject({
      type: "semantic",
      name: "btn",
      value: "Step 1",
      target: "Step 2 -> /done"
    });
  });

  it("requires both a label and a target for btn", () => {
    expect(parseOrvi("btn: -> /x").diagnostics.map((d) => d.code)).toEqual(["ORVI_INVALID_SEMANTIC"]);
    expect(parseOrvi("btn: Label only").diagnostics.map((d) => d.code)).toEqual(["ORVI_INVALID_SEMANTIC"]);
  });

  it("sanitizes code-fence language tokens", () => {
    const ok = parseOrvi("```c++ | main.cpp\nint main(){}\n```");
    expect(ok.children[0]).toMatchObject({ type: "code", language: "c++", filename: "main.cpp" });

    const trimmed = parseOrvi("```js extra words | app.js\ncode\n```");
    expect(trimmed.children[0]).toMatchObject({ type: "code", language: "js", filename: "app.js" });

    const invalid = parseOrvi('```"><script>\ncode\n```');
    expect(invalid.children[0]).toMatchObject({ type: "code" });
    expect((invalid.children[0] as { language?: string }).language).toBeUndefined();
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
