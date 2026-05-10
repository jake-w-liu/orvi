import { renderLux } from "../src/renderer";

describe("renderLux", () => {
  it("renders escaped semantic HTML with Lux classes", () => {
    const result = renderLux(`# Hi <script>

[red bold] Important []

[card bg=blue]
  **Safe <b>bold</b>**
[/card]

btn: Docs -> https://example.com`);

    expect(result.ast.diagnostics).toEqual([]);
    expect(result.html).toContain("<h1>Hi &lt;script&gt;</h1>");
    expect(result.html).toContain('class="lux-text-red lux-font-bold"');
    expect(result.html).toContain('class="lux-card lux-bg-blue"');
    expect(result.html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(result.html).toContain('href="https://example.com"');
  });

  it("renders grids and CSS-only tabs", () => {
    const result = renderLux(`[grid 2]
left
---
right
[/grid]

[tabs]
  [tab label=One]
    First
  [/tab]
  [tab label=Two]
    Second
  [/tab]
[/tabs]`);

    expect(result.ast.diagnostics).toEqual([]);
    expect(result.html).toContain("lux-grid lux-grid-2");
    expect(result.html).toContain('type="radio"');
    expect(result.html).toContain("lux-tab-panel");
  });

  it("sanitizes unsafe URLs", () => {
    const result = renderLux("btn: Bad -> javascript:alert(1)");
    expect(result.html).toContain('href="#"');
  });

  it("can emit a full HTML document with base CSS", () => {
    const result = renderLux("# Full", {
      fullDocument: true,
      title: "Doc",
      theme: { colors: { blue: "#0f766e" }, radius: "0.25rem" }
    });
    expect(result.html).toContain("<!doctype html>");
    expect(result.html).toContain("<title>Doc</title>");
    expect(result.html).toContain(".lux-document");
    expect(result.html).toContain("--lux-blue: #0f766e;");
    expect(result.html).toContain("--lux-radius: 0.25rem;");
  });
});
