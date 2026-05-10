import { formatLux } from "../src/formatter";

describe("formatLux", () => {
  it("formats block structure and nested components canonically", () => {
    const result = formatLux(`# Title
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
    const result = formatLux(`\`\`\`ts | app.ts
const value = 1;
  console.log(value);
\`\`\`

| A | Longer |
| --- | --- |
| x | y |`);

    expect(result.diagnostics).toEqual([]);
    expect(result.formatted).toContain("  console.log(value);");
    expect(result.formatted).toContain("| A   | Longer |");
  });

  it("preserves canonical document metadata", () => {
    const result = formatLux(`---
dir: rtl
lux: 0.1
lang: ar
title: Arabic Doc
---
# RTL Title`);

    expect(result.diagnostics).toEqual([]);
    expect(result.formatted).toBe(`---
lux: 0.1
title: Arabic Doc
lang: ar
dir: rtl
---

# RTL Title
`);
  });
});
