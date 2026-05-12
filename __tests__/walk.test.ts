import { parseOrvi } from "../src/parser";
import { walk } from "../src/walk";
import type { OrviNode } from "../src/walk";

function nodeTypes(source: string): string[] {
  const types: string[] = [];
  walk(parseOrvi(source), (node) => types.push(node.type));
  return types;
}

describe("walk — AST traversal", () => {
  it("visits the document, then every block, then inline descendants (pre-order)", () => {
    const types = nodeTypes("# Title with [a](u)\n\nA **bold** word.");
    expect(types[0]).toBe("document");
    expect(types).toEqual(
      expect.arrayContaining(["document", "heading", "text", "link", "paragraph", "strong"])
    );
    // The heading's inline children come before the paragraph (pre-order).
    expect(types.indexOf("heading")).toBeLessThan(types.indexOf("paragraph"));
    expect(types.indexOf("link")).toBeLessThan(types.indexOf("paragraph"));
  });

  it("descends into grid columns, table cells, and list items", () => {
    const source = `[grid 2]
  left
  ---
  right
[/grid]

| H1 | H2 |
| --- | --- |
| a | b |

- one
- two`;
    const types = nodeTypes(source);
    expect(types).toEqual(expect.arrayContaining(["component", "table", "list"]));
    // 2 grid column paragraphs + 2 header cells (paragraphs? no — InlineNode[]):
    // table headers/rows are arrays of inline nodes, so their cell text shows up
    // as `text` nodes; list items likewise.
    const textCount = types.filter((t) => t === "text").length;
    expect(textCount).toBeGreaterThanOrEqual(6); // left, right, H1, H2, a, b, one, two
  });

  it("can collect nodes of a given type", () => {
    const links: OrviNode[] = [];
    walk(parseOrvi("see [x](http://x) and [y](http://y)"), (node) => {
      if (node.type === "link") links.push(node);
    });
    expect(links).toHaveLength(2);
    expect(links.map((n) => (n as { href: string }).href)).toEqual(["http://x", "http://y"]);
  });

  it("does not throw on a malformed AST with missing child arrays", () => {
    const bad = { type: "document" } as unknown as Parameters<typeof walk>[0];
    expect(() => walk(bad, () => {})).not.toThrow();
  });
});
