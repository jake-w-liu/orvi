import { parseOrvi } from "../src/parser";
import { renderOrvi } from "../src/renderer";
import { formatOrvi } from "../src/formatter";

// A coarse regression gate: a large, structurally varied document must parse,
// render, and format well under a fixed budget. The budget has a lot of
// headroom (a warm run is ~1–2 orders of magnitude faster on a dev machine and
// on CI runners) — it is here to catch an accidental super-linear blow-up, not
// to micro-benchmark. Adversarial-input *safety* (no throws, bounded nesting)
// is covered by the parser and property tests.
const BUDGET_MS = 3000;

function buildLargeDocument(sections: number): string {
  const parts: string[] = [
    "---",
    "orvi: 0.1",
    "title: Large Document",
    "lang: en",
    "dir: ltr",
    "---",
    ""
  ];
  const colors = ["blue", "green", "purple", "cyan", "orange", "red"];
  for (let i = 0; i < sections; i++) {
    const color = colors[i % colors.length];
    parts.push(
      `# Section ${i + 1}`,
      "",
      `A paragraph with **bold ${i}**, _italic_, ~~strike~~, [${color}] tinted [] text and \`code\`.`,
      "",
      "[callout type=info]",
      `  Note ${i}: see [bg=${color} lg] this []`,
      "[/callout]",
      "",
      "[grid 2]",
      "  [card]",
      `    ### Card ${i}A`,
      "",
      "    Body text.",
      "  [/card]",
      "  ---",
      `  [card bg=${color}]`,
      `    ### Card ${i}B`,
      "",
      "    Body text.",
      "  [/card]",
      "[/grid]",
      "",
      "| Name | Value |",
      "| --- | --- |",
      `| Row ${i} | ${i * 7} |`,
      `| Row ${i + 1} | ${i * 13} |`,
      "",
      `- item ${i}.1`,
      `- item ${i}.2`,
      "",
      "```ts | snippet.ts",
      `const v${i} = ${i};`,
      "```",
      "",
      `btn: Open ${i} -> https://example.com/${i}`,
      `img: ./fig-${i}.png | Figure ${i}: A | B | C`,
      `badge: Section ${i} | type=info`,
      "hr:",
      ""
    );
  }
  return parts.join("\n");
}

describe("performance (regression gate)", () => {
  it("parses, renders, and formats a large document within the time budget", () => {
    const source = buildLargeDocument(400);
    expect(source.length).toBeGreaterThan(100_000);

    // Warm-up (JIT, module init) so the measured run reflects steady state.
    parseOrvi(source);
    renderOrvi(source, { fullDocument: true });
    formatOrvi(source);

    const start = performance.now();
    const ast = parseOrvi(source);
    const { html } = renderOrvi(source, { fullDocument: true });
    const { formatted } = formatOrvi(source);
    const elapsed = performance.now() - start;

    expect(ast.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(html.length).toBeGreaterThan(source.length); // produced real output
    expect(formatted.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it("stays linear on adversarial inline input (no quadratic blow-up)", () => {
    // These shapes drove the old per-character re-scans super-linear. The
    // single-pass scanner plus the linear scope pre-pass keep them fast. The
    // budget is deliberately loose — a real quadratic regression on these sizes
    // is orders of magnitude over it, so a generous bound avoids timing flakes
    // on a loaded machine while still catching a blow-up.
    const attacks = [
      "[red]".repeat(4000), // many scope openers, no close
      "word_".repeat(40000), // many emphasis-`_` candidates
      "**".repeat(40000), // many strong delimiters
      "[".repeat(80000), // many unmatched brackets, no `]`
      "[red]".repeat(4000) + " []" // openers plus a single distant close
    ];
    const LINEAR_BUDGET_MS = 8000;

    // Warm-up so the timed run reflects steady state (JIT, module init).
    for (const attack of attacks) {
      parseOrvi(attack);
      renderOrvi(attack);
      formatOrvi(attack);
    }

    for (const attack of attacks) {
      const start = performance.now();
      const ast = parseOrvi(attack);
      renderOrvi(attack);
      formatOrvi(attack);
      const elapsed = performance.now() - start;
      expect(Array.isArray(ast.children)).toBe(true);
      expect(elapsed).toBeLessThan(LINEAR_BUDGET_MS);
    }
  });
});
