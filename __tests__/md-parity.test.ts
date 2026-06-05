import { parseOrvi } from "../src/parser";
import { renderOrvi } from "../src/renderer";
import { formatOrvi } from "../src/formatter";
import type { EmphasisNode, InlineCodeNode, LinkNode, ParagraphNode, TableNode } from "../src/ast";

// Markdown-parity constructs added in orvi 0.2 / orvi-lang 1.3:
// backslash escaping, inline code spans, single-`*` emphasis, hard line
// breaks, bare http(s) autolinks, and table column alignment.

function firstParagraph(source: string): ParagraphNode {
  const ast = parseOrvi(source);
  expect(ast.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const para = ast.children[0];
  expect(para?.type).toBe("paragraph");
  return para as ParagraphNode;
}

function roundTripsRender(source: string): void {
  const formatted = formatOrvi(source).formatted;
  expect(renderOrvi(formatted).html).toBe(renderOrvi(source).html);
  expect(formatOrvi(formatted).formatted).toBe(formatted);
}

describe("backslash escaping", () => {
  it("turns escaped punctuation into the literal character", () => {
    expect(renderOrvi("\\*not italic\\*").html).toContain("<p>*not italic*</p>");
    expect(renderOrvi("\\`not code\\`").html).toContain("<p>`not code`</p>");
    expect(renderOrvi("\\[not scope]").html).toContain("<p>[not scope]</p>");
    expect(renderOrvi("price is 5 \\* 3").html).toContain("price is 5 * 3");
  });

  it("keeps a backslash before a non-punctuation character literal", () => {
    expect(renderOrvi("path C:\\temp here").html).toContain("path C:\\temp here");
  });

  it("re-escapes literal markup so it round-trips through the formatter", () => {
    roundTripsRender("literal \\*stars\\*, a \\`tick\\` and a \\[bracket]\n");
  });
});

describe("inline code spans", () => {
  it("parses a code span and HTML-escapes its content", () => {
    const para = firstParagraph("use `a < b && c` here");
    expect(para.children.map((c) => c.type)).toEqual(["text", "inlineCode", "text"]);
    expect((para.children[1] as InlineCodeNode).value).toBe("a < b && c");
    expect(renderOrvi("use `a < b` x").html).toContain('<code class="orvi-code-inline">a &lt; b</code>');
  });

  it("does not parse markup inside a code span", () => {
    expect(renderOrvi("`**not bold** _no_`").html).toContain(
      '<code class="orvi-code-inline">**not bold** _no_</code>'
    );
  });

  it("leaves an unpaired backtick literal", () => {
    expect(renderOrvi("a ` b").html).toContain("<p>a ` b</p>");
  });

  it("round-trips", () => {
    expect(formatOrvi("call `fn(x)` now\n").formatted).toBe("call `fn(x)` now\n");
  });
});

describe("single-asterisk emphasis", () => {
  it("renders *text* as <em> and records the marker", () => {
    const para = firstParagraph("a *italic* b");
    const emphasis = para.children[1] as EmphasisNode;
    expect(emphasis.type).toBe("emphasis");
    expect(emphasis.marker).toBe("*");
    expect(renderOrvi("a *italic* b").html).toContain("a <em>italic</em> b");
  });

  it("keeps ** as strong, not two emphases", () => {
    expect(renderOrvi("**bold**").html).toContain("<strong>bold</strong>");
  });

  it("does not emphasize space-flanked or arithmetic asterisks", () => {
    expect(renderOrvi("2 * 3 * 4").html).toContain("<p>2 * 3 * 4</p>");
    expect(renderOrvi("a _ b _ c").html).toContain("<p>a _ b _ c</p>");
  });

  it("re-emits each emphasis with its original marker", () => {
    expect(formatOrvi("a *x* and _y_\n").formatted).toBe("a *x* and _y_\n");
  });
});

describe("hard line breaks", () => {
  it("turns a trailing backslash into a <br>", () => {
    const para = firstParagraph("Line one\\\nLine two");
    expect(para.children.map((c) => c.type)).toEqual(["text", "hardBreak", "text"]);
    expect(renderOrvi("Line one\\\nLine two").html).toContain("Line one<br>Line two");
  });

  it("treats a plain wrap as a soft space", () => {
    expect(renderOrvi("Line one\nLine two").html).toContain("Line one Line two");
  });

  it("round-trips", () => {
    expect(formatOrvi("a\\\nb\n").formatted).toBe("a\\\nb\n");
  });
});

describe("bare autolinks", () => {
  it("links a bare http(s) URL", () => {
    const para = firstParagraph("see https://example.com/a now");
    const link = para.children[1] as LinkNode;
    expect(link.type).toBe("link");
    expect(link.auto).toBe(true);
    expect(link.href).toBe("https://example.com/a");
    expect(renderOrvi("see https://example.com/a now").html).toContain(
      '<a class="orvi-link" href="https://example.com/a">https://example.com/a</a>'
    );
  });

  it("strips trailing sentence punctuation but keeps balanced parens", () => {
    expect((firstParagraph("at https://e/path_(v1) end").children[1] as LinkNode).href).toBe("https://e/path_(v1)");
    expect((firstParagraph("at https://e/x. end").children[1] as LinkNode).href).toBe("https://e/x");
  });

  it("only links http(s) — never javascript:, mailto bare, or intra-word", () => {
    expect(renderOrvi("javascript:alert(1)").html).not.toMatch(/<a /);
    expect(renderOrvi("email a@b.com here").html).not.toMatch(/<a /);
    expect(renderOrvi("xhttps://e/x").html).not.toMatch(/<a /);
  });

  it("round-trips as the bare URL", () => {
    expect(formatOrvi("see https://x.com/a now\n").formatted).toBe("see https://x.com/a now\n");
    roundTripsRender("read https://x.com/p, then https://y.org.\n");
  });
});

describe("table column alignment", () => {
  it("parses :--- / :-: / ---: into alignment and renders classes", () => {
    const source = "| L | C | R |\n| :--- | :---: | ---: |\n| a | b | c |";
    const table = parseOrvi(source).children[0] as TableNode;
    expect(table.aligns).toEqual(["left", "center", "right"]);
    const html = renderOrvi(source).html;
    expect(html).toContain('<th class="orvi-align-left">L</th>');
    expect(html).toContain('<th class="orvi-align-center">C</th>');
    expect(html).toContain('<td class="orvi-align-right">c</td>');
  });

  it("leaves an undecorated column unaligned", () => {
    const html = renderOrvi("| A | B |\n| --- | :---: |\n| x | y |").html;
    expect(html).toContain("<th>A</th>");
    expect(html).toContain('<th class="orvi-align-center">B</th>');
  });

  it("round-trips the alignment markers through the formatter", () => {
    roundTripsRender("| L | C | R |\n| :--- | :---: | ---: |\n| a | b | c |\n");
  });
});
