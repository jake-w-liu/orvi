import { parseOrvi } from "../src/parser";
import { renderOrvi } from "../src/renderer";
import { formatOrvi } from "../src/formatter";
import { walk } from "../src/walk";
import type { BlockquoteNode } from "../src/ast";

// Blockquotes — added in orvi-lang 1.4 (spec 0.3). A run of `>`-prefixed lines;
// one `>` (+ optional space) is stripped per line and the residual is parsed
// recursively, so a quote may contain any block content and nested `> >`.

function roundTrips(source: string): void {
  const formatted = formatOrvi(source).formatted;
  expect(formatOrvi(source).diagnostics.filter((d) => d.code.startsWith("ORVI_FORMAT_"))).toEqual([]);
  expect(renderOrvi(formatted).html).toBe(renderOrvi(source).html);
  expect(formatOrvi(formatted).formatted).toBe(formatted);
}

describe("blockquotes", () => {
  it("parses a blockquote into a BlockquoteNode with block children", () => {
    const ast = parseOrvi("> Hello\n> world");
    const quote = ast.children[0] as BlockquoteNode;
    expect(quote.type).toBe("blockquote");
    expect(quote.children[0]?.type).toBe("paragraph");
    expect(renderOrvi("> Hello\n> world").html).toContain(
      '<blockquote class="orvi-quote"><p>Hello world</p></blockquote>'
    );
  });

  it("nests with `> >` and normalizes `>>`", () => {
    expect(renderOrvi("> outer\n> > inner").html).toContain(
      '<blockquote class="orvi-quote"><p>outer</p>\n<blockquote class="orvi-quote"><p>inner</p></blockquote></blockquote>'
    );
    // `>>` and `> >` parse to the same nested structure.
    expect(renderOrvi(">> x").html).toBe(renderOrvi("> > x").html);
  });

  it("contains block content (heading, list, code)", () => {
    const html = renderOrvi("> ## Title\n>\n> - a\n> - b").html;
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain('<ul class="orvi-list"><li>a</li><li>b</li></ul>');
    expect(renderOrvi("> ```js\n> const x = 1;\n> ```").html).toContain('<code class="language-js">const x = 1;</code>');
  });

  it("ends a preceding paragraph (no lazy continuation)", () => {
    const ast = parseOrvi("text\n> quote");
    expect(ast.children.map((n) => n.type)).toEqual(["paragraph", "blockquote"]);
  });

  it("HTML-escapes a literal `>` in text and round-trips an escaped leader", () => {
    expect(renderOrvi("2 > 1").html).toContain("2 &gt; 1");
    expect(renderOrvi("\\> not a quote").html).toContain("<p>&gt; not a quote</p>");
    roundTrips("\\> not a quote\n");
  });

  it("is traversed by walk()", () => {
    const types: string[] = [];
    walk(parseOrvi("> # H\n> para"), (n) => types.push(n.type));
    expect(types).toEqual(expect.arrayContaining(["blockquote", "heading", "paragraph"]));
  });

  it("caps nesting depth instead of overflowing the stack", () => {
    const ast = parseOrvi(`${"> ".repeat(5000)}deep`);
    expect(ast.diagnostics.map((d) => d.code)).toContain("ORVI_MAX_NESTING_DEPTH");
    expect(Array.isArray(ast.children)).toBe(true);
  });

  it("round-trips a variety of quotes", () => {
    roundTrips("> a\n> b\n");
    roundTrips("> outer\n> > inner\n");
    roundTrips("> ## Title\n>\n> - a\n> - b\n");
    roundTrips("> quote\n\nafter\n");
  });
});
