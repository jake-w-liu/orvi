import { formatOrvi } from "../src/formatter";

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
});
