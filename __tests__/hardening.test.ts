import { parseOrvi } from "../src/parser";
import { renderOrvi } from "../src/renderer";
import { formatOrvi } from "../src/formatter";
import { walk } from "../src/walk";
import type { InlineNode, StrongNode } from "../src/ast";

// Regression coverage for the audit-confirmed correctness/security fixes.

describe("block boundaries (A5/A6)", () => {
  it("does not absorb a table that follows a paragraph with no blank line", () => {
    const ast = parseOrvi("Intro line\n| H |\n| --- |\n| r |");
    expect(ast.children.map((n) => n.type)).toEqual(["paragraph", "table"]);
  });

  it("keeps a single-cell pipe line over a bare --- as a paragraph plus thematic break", () => {
    const ast = parseOrvi("| Note |\n---\nbody");
    expect(ast.children.map((n) => n.type)).toEqual(["paragraph", "thematicBreak", "paragraph"]);
  });

  it("still recognizes a real single-column table (piped divider)", () => {
    const ast = parseOrvi("| Col |\n| --- |\n| x |");
    expect(ast.children[0]?.type).toBe("table");
  });
});

describe("render-time class validation (A7)", () => {
  it("never lets an invalid option inject extra class tokens", () => {
    const callout = renderOrvi('[callout type="info evil"]\nx\n[/callout]').html;
    expect(callout).toContain('class="orvi-callout orvi-callout-info"');
    expect(callout).not.toContain("evil");

    const card = renderOrvi('[card bg="gray evil"]\nx\n[/card]').html;
    expect(card).not.toContain("evil");

    const badge = renderOrvi('badge: Hi | type="info evil"').html;
    expect(badge).toContain('class="orvi-badge orvi-badge-info"');
    expect(badge).not.toContain("evil");
  });
});

describe("walk is iterative (A10)", () => {
  it("does not overflow the stack on a very deep AST", () => {
    let inner: InlineNode = { type: "text", loc: { line: 1, column: 1 }, value: "deep" };
    for (let i = 0; i < 50000; i++) {
      inner = { type: "strong", loc: { line: 1, column: 1 }, children: [inner] } as StrongNode;
    }
    let count = 0;
    expect(() => walk(inner, () => (count += 1))).not.toThrow();
    expect(count).toBe(50001); // 50000 strong wrappers + 1 text leaf
  });
});

describe("safeUrl neutralization (A11)", () => {
  const linkHref = (href: string): string => {
    const html = renderOrvi(`[x](${href})`).html;
    return /href="([^"]*)"/.exec(html)?.[1] ?? "";
  };

  it("neutralizes dangerous or malformed schemes to #", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>",
      "vbscript:msgbox(1)",
      "//evil.example.com",
      "java\tscript:alert(1)"
    ]) {
      expect(linkHref(href)).toBe("#");
    }
  });

  it("allows safe and relative URLs", () => {
    expect(linkHref("https://example.com/p")).toBe("https://example.com/p");
    expect(linkHref("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(linkHref("tel:+15551234")).toBe("tel:+15551234");
    expect(linkHref("/local/path")).toBe("/local/path");
    expect(linkHref("./relative.ov")).toBe("./relative.ov");
  });
});

describe("formatter loss diagnostics (A3)", () => {
  it("warns when a badge value cannot round-trip through the option heuristic", () => {
    // The text parses to value `|e=o` with no options; re-emitting it bare would
    // re-parse `e=o` as options, dropping the value — so the formatter warns.
    const result = formatOrvi("badge: |e=o|==~\n");
    expect(result.diagnostics.map((d) => d.code)).toContain("ORVI_FORMAT_BADGE_VALUE_DROPPED");
  });

  it("does not warn for a normal badge with options", () => {
    const result = formatOrvi("badge: Beta | type=warning\n");
    expect(result.diagnostics.filter((d) => d.code.startsWith("ORVI_FORMAT_"))).toEqual([]);
  });
});

describe("round-trip after the deep bug hunt", () => {
  const roundTrips = (source: string): void => {
    const formatted = formatOrvi(source).formatted;
    expect(formatOrvi(source).diagnostics.filter((d) => d.code.startsWith("ORVI_FORMAT_"))).toEqual([]);
    expect(renderOrvi(formatted).html).toBe(renderOrvi(source).html);
    expect(formatOrvi(formatted).formatted).toBe(formatted);
  };

  it("escapes a paragraph that begins with a block marker (FMT-1/FMT-2)", () => {
    for (const source of [
      "\\# not a heading\n",
      "\\- not a list\n",
      "1\\. not a list\n",
      "\\---\n",
      "\\// not a comment\n",
      "btn\\: not a button\n"
    ]) {
      roundTrips(source);
      // and the escaped form must still render as a paragraph, not the block
      expect(renderOrvi(source).html).toContain("<p>");
    }
  });

  it("neutralizes a literal URL in text so it does not autolink on re-parse (F1)", () => {
    roundTrips("see http\\://e.com here\n");
    expect(renderOrvi("see http\\://e.com here").html).not.toMatch(/<a /);
  });

  it("keeps a bare autolink boundary against following punctuation", () => {
    roundTrips("[red](http://x)\\|\n");
    roundTrips("link https://e.com\\#frag tail\n");
    // A trim-set char (`:`) followed by a non-trim char (`#`) is absorbed whole
    // unless the boundary is escaped (fast-check counterexample).
    roundTrips("https://e.com/p_(x)hr:\\#\n");
    // A fully-trimmed trailing run (`)`) needs no escape and stays clean.
    expect(formatOrvi("[ ](https://x) tail\n").formatted).toContain("](https://x) tail");
  });

  it("round-trips escaped and code-span pipes in table cells (F3)", () => {
    roundTrips("| a | b |\n| --- | --- |\n| x \\| y | z |\n");
    roundTrips("| a | b |\n| --- | --- |\n| `x|y` | z |\n");
  });
});

describe("table parsing regressions", () => {
  it("keeps one table when a divider-shaped row appears among body rows (TABLE-LOOKAHEAD-SPLIT)", () => {
    const ast = parseOrvi("| H1 | H2 |\n| --- | --- |\n| x | y |\n| --- | --- |\n| z | w |");
    expect(ast.children.map((n) => n.type)).toEqual(["table"]);
    const table = ast.children[0] as { rows: unknown[] };
    expect(table.rows).toHaveLength(3);
  });

  it("keeps an inline-code span with a pipe inside one table cell (F3)", () => {
    const ast = parseOrvi("| Name | Code |\n| --- | --- |\n| x | `a|b` |");
    expect(ast.children[0]?.type).toBe("table");
    expect(renderOrvi("| Name | Code |\n| --- | --- |\n| x | `a|b` |").html).toContain(
      '<code class="orvi-code-inline">a|b</code>'
    );
  });
});

describe("inline scope matching regressions", () => {
  it("matches a valid scope regardless of preceding unclosed openers (INLINE-2)", () => {
    const html = renderOrvi("[red]".repeat(100) + "[red]Important[]").html;
    expect(html).toContain('<span class="orvi-text-red">Important</span>');
  });

  it("ignores an escaped bracket inside a scope (INLINE-3)", () => {
    const html = renderOrvi("[red]a \\[blue] b[]").html;
    expect(html).toContain('<span class="orvi-text-red">a [blue] b</span>');
  });

  it("ignores a bracket inside an inline-code span when matching scopes", () => {
    const html = renderOrvi("[red] x `[blue]` y[]").html;
    expect(html).toContain('<span class="orvi-text-red">');
    expect(html).toContain('<code class="orvi-code-inline">[blue]</code>');
  });
});
