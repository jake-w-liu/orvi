import { readFileSync } from "fs";
import { join } from "path";
import { benchmarkCorpus } from "../benchmarks/corpus";
import { createBenchmarkReport, measureCorpus, measureFixture } from "../benchmarks/measurements";
import { renderOrvi } from "../src/renderer";

describe("benchmark corpus token-ish efficiency", () => {
  it("defines a deterministic large-ish corpus", () => {
    const names = benchmarkCorpus.map((fixture) => fixture.name);

    expect(benchmarkCorpus).toHaveLength(27);
    expect(new Set(names).size).toBe(names.length);
    expect(measureCorpus().orviChars).toBeGreaterThan(18000);
  });

  it("renders every fixture to the paired equivalent HTML", () => {
    for (const fixture of benchmarkCorpus) {
      const result = renderOrvi(fixture.orvi);

      expect(result.ast.diagnostics).toEqual([]);
      expect(result.html).toBe(fixture.html);
    }
  });

  it("keeps fixture byte and character measurements stable", () => {
    const measurements = benchmarkCorpus.map(measureFixture);

    expect(measurements[0]).toEqual({
      name: "product-brief",
      orviChars: 348,
      orviBytes: 348,
      htmlChars: 610,
      htmlBytes: 610,
      charRatio: 1.753,
      byteRatio: 1.753
    });
    expect(measurements.at(-1)).toEqual({
      name: "willow-operating-review",
      orviChars: 1025,
      orviBytes: 1025,
      htmlChars: 2341,
      htmlBytes: 2341,
      charRatio: 2.284,
      byteRatio: 2.284
    });
    expect(measurements.every((measurement) => measurement.orviChars > 300)).toBe(true);
  });

  it("keeps corpus-level compression ratios stable", () => {
    const totals = measureCorpus();

    expect(totals).toMatchInlineSnapshot(`
     {
       "byteRatio": 2.298,
       "charRatio": 2.298,
       "fixtureCount": 27,
       "htmlBytes": 58584,
       "htmlChars": 58584,
       "orviBytes": 25496,
       "orviChars": 25496,
     }
    `);
    expect(totals.byteRatio).toBeGreaterThanOrEqual(2.2);
    expect(totals.charRatio).toBeGreaterThanOrEqual(2.2);
  });

  it("keeps the static benchmark report in sync", () => {
    const reportPath = join(__dirname, "..", "docs", "benchmarks.md");

    expect(readFileSync(reportPath, "utf8")).toBe(createBenchmarkReport());
  });
});
