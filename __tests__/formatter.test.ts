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
});
