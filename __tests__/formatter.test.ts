import { formatOrvi, formatOrviFromAst } from "../src/formatter";
import { renderOrvi, renderToHtml } from "../src/renderer";
import { parseOrvi } from "../src/parser";

describe("formatOrvi", () => {
  it("formats block structure and nested components canonically", () => {
    const result = formatOrvi(`# Title
[grid 2]
left
---
[card bg=blue]
**right**
[/card]
[/grid]
badge: Beta | type=warning`);

    expect(result.diagnostics).toEqual([]);
    expect(result.formatted).toBe(`# Title

[grid 2]
  left
  ---
  [card bg=blue]
    **right**
  [/card]
[/grid]

badge: Beta | type=warning
`);
  });

  it("formats code blocks and tables without changing code content", () => {
    const result = formatOrvi(`\`\`\`ts | app.ts
const value = 1;
  console.log(value);
\`\`\`

| A | Longer |
| --- | --- |
| x | y |`);

    expect(result.diagnostics).toEqual([]);
    expect(result.formatted).toContain("  console.log(value);");
    expect(result.formatted).toContain("| A   | Longer |");
    expect(result.formatted).toContain("```ts | app.ts");
    expect(result.formatted).not.toContain("``` ts");
  });

  it("does not mutate a code block nested inside a component (idempotent)", () => {
    const source = `[callout type=info]
  \`\`\`js
  const x = 1;
  \`\`\`
[/callout]
`;
    const first = formatOrvi(source);
    expect(first.diagnostics).toEqual([]);
    // Only the fence lines carry the component indentation; the code text is
    // preserved verbatim, so formatting is idempotent.
    expect(first.formatted).toBe(source);
    expect(formatOrvi(first.formatted).formatted).toBe(first.formatted);

    const callout = first.ast.children[0] as { children: Array<{ type: string; value?: string }> };
    expect(callout.children[0]).toMatchObject({ type: "code", value: "  const x = 1;" });
  });

  it("preserves canonical document metadata", () => {
    const result = formatOrvi(`---
dir: rtl
orvi: 0.1
lang: ar
title: Arabic Doc
---
# RTL Title`);

    expect(result.diagnostics).toEqual([]);
    expect(result.formatted).toBe(`---
orvi: 0.1
title: Arabic Doc
lang: ar
dir: rtl
---

# RTL Title
`);
  });

  it("warns before dropping an unrecognized metadata key", () => {
    const result = formatOrvi(`---
orvi: 0.1
futurekey: keep me
---
# Title`);

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "warning",
          code: "ORVI_FORMAT_METADATA_DROPPED",
          line: 3,
          column: 1
        })
      ])
    );
    expect(result.formatted).not.toContain("futurekey");
  });

  it("is idempotent for a paragraph whose source begins with a bare marker", () => {
    for (const source of ["*\nfoo", "5.\nfoo", "-\nbar", "1.\nbaz", "x\n*\ny", "#\nfoo", "### \nbar", "#\n# x"]) {
      const once = formatOrvi(source).formatted;
      const twice = formatOrvi(once).formatted;
      expect(twice).toBe(once);
    }
  });

  it("does not change what a document renders to (no semantic drift) for bare-marker inputs", () => {
    for (const source of ["#\nfoo", "### text", "*\nfoo", "5.\nfoo", "-\nbar"]) {
      const r = formatOrvi(source);
      expect(r.diagnostics.filter((d) => d.code.startsWith("ORVI_FORMAT_"))).toEqual([]);
      expect(renderOrvi(source).html).toBe(renderOrvi(r.formatted).html);
    }
  });

  it("keeps pipes in img alt text and badge labels (round-trips)", () => {
    const source = `img: ./diagram.png | Flow: A | B | C

badge: One | Two | type=warning
`;
    const first = formatOrvi(source);
    expect(first.diagnostics).toEqual([]);
    const second = formatOrvi(first.formatted);
    expect(second.formatted).toBe(first.formatted);

    const [img, badge] = second.ast.children;
    expect(img).toMatchObject({ type: "semantic", name: "img", value: "./diagram.png", alt: "Flow: A | B | C" });
    expect(badge).toMatchObject({ type: "semantic", name: "badge", value: "One | Two", options: { type: "warning" } });
  });

  it("warns before dropping comment lines", () => {
    const result = formatOrvi(`// keep this note
# Title

\`\`\`
// code comment is preserved
\`\`\``);

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "warning",
          code: "ORVI_FORMAT_COMMENT_DROPPED",
          line: 1,
          column: 1
        })
      ])
    );
    expect(result.formatted).toContain("// code comment is preserved");
  });

  // Orvi option quotes are verbatim (the parser does no backslash de-escaping),
  // so the formatter must not quote with JSON.stringify — that corrupts
  // backslashes/control chars and compounds on every pass.
  describe("option value quoting (B3)", () => {
    // Format once, then parse the formatted output and read back the tab label.
    const label = (source: string): string => {
      const ast = parseOrvi(formatOrvi(source).formatted);
      const tabs = ast.children[0] as { children: { options: { label: string } }[] };
      return tabs.children[0]!.options.label;
    };

    it("preserves a backslash in an option value and stays idempotent", () => {
      const source = '[tabs]\n[tab label="C:\\path dir"]\nbody\n[/tab]\n[/tabs]\n';
      const once = formatOrvi(source).formatted;
      expect(once).toBe(formatOrvi(once).formatted); // idempotent
      expect(label(source)).toBe("C:\\path dir"); // value not corrupted
    });

    it("preserves a literal tab in an option value", () => {
      const source = '[tabs]\n[tab label="x\ty z"]\nbody\n[/tab]\n[/tabs]\n';
      const once = formatOrvi(source).formatted;
      expect(once).toBe(formatOrvi(once).formatted);
      expect(label(source)).toBe("x\ty z");
    });

    it("uses single quotes when the value contains a double quote", () => {
      const source = '[tabs]\n[tab label=\'say "hi" now\']\nbody\n[/tab]\n[/tabs]\n';
      expect(label(source)).toBe('say "hi" now');
      expect(formatOrvi(source).formatted).toContain("label='say \"hi\" now'");
    });

    it("warns rather than silently corrupting an unrepresentable value (whitespace + both quotes)", () => {
      // Adjacent quoted segments concatenate to one token whose value contains a
      // space and both quote characters.
      const source = '[tab x="a b"\'c\']\ny\n[/tab]\n';
      const codes = formatOrvi(source).diagnostics.map((d) => d.code);
      expect(codes).toContain("ORVI_FORMAT_OPTION_VALUE_DROPPED");
    });
  });
});

describe("formatOrviFromAst (parse-once pipeline)", () => {
  it("matches formatOrvi output when given the same source and AST", () => {
    const source = `# Title

[grid 2]
left
---
[card bg=blue]
**right**
[/card]
[/grid]

// this comment is dropped
`;
    const fromSource = formatOrvi(source);
    const ast = parseOrvi(source);
    const fromAst = formatOrviFromAst(ast, { source });

    expect(fromAst.formatted).toBe(fromSource.formatted);
    expect(fromAst.diagnostics.map((d) => d.code).sort()).toEqual(
      fromSource.diagnostics.map((d) => d.code).sort()
    );
  });

  it("formats without source and still reports AST-level losses", () => {
    const source = '[tab x="a b"\'c\']\ny\n[/tab]\n';
    const fromAst = formatOrviFromAst(parseOrvi(source));
    expect(fromAst.formatted.length).toBeGreaterThan(0);
    expect(fromAst.diagnostics.map((d) => d.code)).toContain("ORVI_FORMAT_OPTION_VALUE_DROPPED");
    // Comment/metadata drops need the original source text.
    expect(fromAst.diagnostics.map((d) => d.code)).not.toContain("ORVI_FORMAT_COMMENT_DROPPED");
  });

  it("supports parse once then render + format without a second parse", () => {
    const source = "# Hello\n\n[blue] hi []\n";
    const ast = parseOrvi(source);
    const html = renderToHtml(ast, { fullDocument: false });
    const { formatted } = formatOrviFromAst(ast, { source });

    expect(html).toContain("<h1>Hello</h1>");
    expect(formatted).toBe(formatOrvi(source).formatted);
  });
});
