import { readFileSync } from "fs";
import { join } from "path";
import { benchmarkCorpus } from "../benchmarks/corpus";
import { createBenchmarkReport, measureCorpus, measureFixture } from "../benchmarks/measurements";
import { renderLux } from "../src/renderer";

describe("benchmark corpus token-ish efficiency", () => {
  it("defines a deterministic large-ish corpus", () => {
    const names = benchmarkCorpus.map((fixture) => fixture.name);

    expect(benchmarkCorpus).toHaveLength(27);
    expect(new Set(names).size).toBe(names.length);
    expect(measureCorpus().luxChars).toBeGreaterThan(18000);
  });

  it("renders every fixture to the paired equivalent HTML", () => {
    for (const fixture of benchmarkCorpus) {
      const result = renderLux(fixture.lux);

      expect(result.ast.diagnostics).toEqual([]);
      expect(result.html).toBe(fixture.html);
    }
  });

  it("keeps fixture byte and character measurements stable", () => {
    const measurements = benchmarkCorpus.map(measureFixture);

    expect(measurements[0]).toEqual({
      name: "product-brief",
      luxChars: 347,
      luxBytes: 347,
      htmlChars: 599,
      htmlBytes: 599,
      charRatio: 1.726,
      byteRatio: 1.726
    });
    expect(measurements.at(-1)).toEqual({
      name: "willow-operating-review",
      luxChars: 1024,
      luxBytes: 1024,
      htmlChars: 2299,
      htmlBytes: 2299,
      charRatio: 2.245,
      byteRatio: 2.245
    });
    expect(measurements.every((measurement) => measurement.luxChars > 300)).toBe(true);
  });

  it("keeps corpus-level compression ratios stable", () => {
    const totals = measureCorpus();

    expect(totals).toMatchInlineSnapshot(`
     {
       "byteRatio": 2.259,
       "charRatio": 2.259,
       "fixtureCount": 27,
       "htmlBytes": 57529,
       "htmlChars": 57529,
       "luxBytes": 25471,
       "luxChars": 25471,
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
