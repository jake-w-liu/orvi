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
      expect.arrayContaining(["LUX_GRID_MISMATCH", "LUX_INVALID_MODIFIER", "LUX_INVALID_SEMANTIC"])
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
});
