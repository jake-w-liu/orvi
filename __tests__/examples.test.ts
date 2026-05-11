import { readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { parseOrvi } from "../src/parser";
import { formatOrvi } from "../src/formatter";
import { renderOrvi } from "../src/renderer";

const examplesDir = resolve(__dirname, "..", "examples");
const exampleFiles = readdirSync(examplesDir)
  .filter((name) => name.endsWith(".ov"))
  .sort();

describe("examples/*.ov", () => {
  it("ships the documented example documents", () => {
    expect(exampleFiles).toEqual(
      expect.arrayContaining(["dashboard.ov", "getting-started.ov", "showcase.ov", "welcome.ov"])
    );
  });

  for (const name of exampleFiles) {
    describe(name, () => {
      const source = readFileSync(join(examplesDir, name), "utf8");

      it("parses without error diagnostics", () => {
        const ast = parseOrvi(source);
        expect(ast.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      });

      it("is already in canonical formatter output and loses nothing", () => {
        const { formatted, diagnostics } = formatOrvi(source);
        expect(diagnostics.filter((diagnostic) => diagnostic.code.startsWith("ORVI_FORMAT_"))).toEqual([]);
        expect(formatted).toBe(source);
      });
    });
  }

  it("the showcase exercises the full v0.1 surface", () => {
    const source = readFileSync(join(examplesDir, "showcase.ov"), "utf8");
    const { html, ast } = renderOrvi(source, { fullDocument: true });

    expect(ast.diagnostics).toEqual([]);

    const expectedClasses = [
      "orvi-text-red",
      "orvi-text-purple",
      "orvi-bg-black",
      "orvi-text-white",
      "orvi-text-2xl",
      "orvi-font-light",
      "orvi-callout-info",
      "orvi-callout-warning",
      "orvi-callout-success",
      "orvi-callout-error",
      "orvi-grid-4",
      "orvi-card",
      "orvi-bg-blue",
      "orvi-tabs",
      "orvi-tab-label",
      "orvi-tab-panel",
      "orvi-btn",
      "orvi-image",
      "orvi-badge-success",
      "orvi-badge-info",
      "orvi-hr",
      "language-ts",
      "orvi-code-title",
      "orvi-table"
    ];
    for (const cls of expectedClasses) {
      expect(html).toContain(cls);
    }

    // The 0.2.0 fixes: a pipe survives inside img alt text and badge labels.
    expect(html).toContain("Pipeline stages: ingest | transform | load");
    expect(html).toContain("Phase 1 | Phase 2 | Phase 3");
  });
});
