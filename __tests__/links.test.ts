import { parseOrvi } from "../src/parser";
import { renderOrvi } from "../src/renderer";
import { formatOrvi } from "../src/formatter";
import type { LinkNode, ParagraphNode } from "../src/ast";

function firstParagraph(source: string): ParagraphNode {
  const ast = parseOrvi(source);
  expect(ast.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const para = ast.children[0];
  expect(para?.type).toBe("paragraph");
  return para as ParagraphNode;
}

describe("inline links — [text](href)", () => {
  it("parses a link into a LinkNode with parsed-inline text", () => {
    const para = firstParagraph("See [the **docs**](https://example.com/x) here.");
    expect(para.children.map((c) => c.type)).toEqual(["text", "link", "text"]);
    const link = para.children[1] as LinkNode;
    expect(link.href).toBe("https://example.com/x");
    expect(link.children.map((c) => c.type)).toEqual(["text", "strong"]);
  });

  it("trims surrounding whitespace in the label and the href", () => {
    const link = firstParagraph("[  spaced label  ](  /path  )").children[0] as LinkNode;
    expect(link.href).toBe("/path");
    expect(link.children).toEqual([expect.objectContaining({ type: "text", value: "spaced label" })]);
  });

  it("renders an anchor with the orvi-link class", () => {
    expect(renderOrvi("[Home](/)").html).toContain('<a class="orvi-link" href="/">Home</a>');
  });

  it("neutralizes a dangerous href via safeUrl", () => {
    const html = renderOrvi("[x](javascript:alert(1))").html;
    expect(html).toContain('<a class="orvi-link" href="#">x</a>');
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it("HTML-escapes the href and the link text", () => {
    const html = renderOrvi('[a<b>](https://e/?q="x"&y=1)').html;
    expect(html).not.toMatch(/<b>/);
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&quot;");
    expect(html).not.toContain('"x"&y=1"');
  });

  it("nests inside an inline scope", () => {
    const html = renderOrvi("[red] go [here](https://h) and back []").html;
    expect(html).toContain('<span class="orvi-text-red"> go <a class="orvi-link" href="https://h">here</a> and back </span>');
  });

  it("round-trips through the formatter (idempotent after the first pass)", () => {
    const source = "Read [the **guide**](https://example.com/g) and [the spec](./spec.md).\n";
    const once = formatOrvi(source);
    expect(once.diagnostics).toEqual([]);
    expect(once.formatted).toBe(source);
    expect(formatOrvi(once.formatted).formatted).toBe(once.formatted);
  });

  it("does not change rendered output through a format pass (no drift)", () => {
    for (const source of [
      "[ x ]( /y )\n",
      "a [b](c) d\n",
      "[**bold**](u)\n",
      "[red] s [l](h) []\n"
    ]) {
      const formatted = formatOrvi(source).formatted;
      expect(renderOrvi(formatted).html).toBe(renderOrvi(source).html);
    }
  });

  it("does NOT treat `[modifiers](...)` as a link — a valid modifier list stays a scope opener", () => {
    // `[red]` is a scope opener; followed by `(x)` text and no `[]`, that's an
    // unclosed scope (the pre-1.1 behavior), not a link.
    const ast = parseOrvi("[red](https://x) text");
    expect(ast.diagnostics.map((d) => d.code)).toContain("ORVI_UNCLOSED_SCOPE");
    expect(renderOrvi("[red](https://x) text").html).toContain("[red](https://x) text");
  });

  it("requires a non-empty label, a non-empty href, and a closing paren", () => {
    expect(renderOrvi("[label]() not a link").html).toContain("[label]() not a link");
    expect(renderOrvi("[label](no close").html).toContain("[label](no close");
    // An empty (whitespace-only) label would format back to `[]` (the scope-close
    // sentinel) and not round-trip, so it is not a link.
    expect(renderOrvi("[ ](https://x) tail").html).toContain("[ ](https://x) tail");
    expect(parseOrvi("[   ](u)").children[0]?.type).toBe("paragraph");
    expect(formatOrvi("[ ](https://x)\n").formatted).toBe("[ ](https://x)\n");
  });

  it("keeps text after the link when the href contains parentheses (stops at the first `)`)", () => {
    const para = firstParagraph("[a](https://e/path_(v1)) tail");
    expect(para.children.map((c) => c.type)).toEqual(["link", "text"]);
    expect((para.children[0] as LinkNode).href).toBe("https://e/path_(v1");
    expect((para.children[1] as { value: string }).value).toBe(") tail");
  });
});
