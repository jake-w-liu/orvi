import { benchmarkCorpus } from "../benchmarks/corpus";
import { renderLux } from "../src/renderer";

interface FixtureMeasurement {
  name: string;
  luxChars: number;
  luxBytes: number;
  htmlChars: number;
  htmlBytes: number;
  charRatio: number;
  byteRatio: number;
}

const expectedFixtureMeasurements: FixtureMeasurement[] = [
  { name: "product-brief", luxChars: 347, luxBytes: 347, htmlChars: 599, htmlBytes: 599, charRatio: 1.726, byteRatio: 1.726 },
  { name: "release-notes", luxChars: 343, luxBytes: 343, htmlChars: 678, htmlBytes: 678, charRatio: 1.977, byteRatio: 1.977 },
  {
    name: "support-playbook",
    luxChars: 387,
    luxBytes: 387,
    htmlChars: 1261,
    htmlBytes: 1261,
    charRatio: 3.258,
    byteRatio: 3.258
  }
];

const expectedTotals = {
  luxChars: 1077,
  luxBytes: 1077,
  htmlChars: 2538,
  htmlBytes: 2538,
  charRatio: 2.357,
  byteRatio: 2.357
};

describe("benchmark corpus token-ish efficiency", () => {
  it("renders every fixture to the paired equivalent HTML", () => {
    for (const fixture of benchmarkCorpus) {
      const result = renderLux(fixture.lux);

      expect(result.ast.diagnostics).toEqual([]);
      expect(result.html).toBe(fixture.html);
    }
  });

  it("keeps fixture byte and character measurements stable", () => {
    const measurements = benchmarkCorpus.map(measureFixture);

    expect(measurements).toEqual(expectedFixtureMeasurements);
  });

  it("keeps corpus-level compression ratios stable", () => {
    const totals = measureCorpus();

    expect(totals).toEqual(expectedTotals);
    expect(totals.byteRatio).toBeGreaterThanOrEqual(1.7);
    expect(totals.charRatio).toBeGreaterThanOrEqual(1.7);
  });
});

function measureFixture(fixture: (typeof benchmarkCorpus)[number]): FixtureMeasurement {
  const luxBytes = byteLength(fixture.lux);
  const htmlBytes = byteLength(fixture.html);

  return {
    name: fixture.name,
    luxChars: fixture.lux.length,
    luxBytes,
    htmlChars: fixture.html.length,
    htmlBytes,
    charRatio: ratio(fixture.html.length, fixture.lux.length),
    byteRatio: ratio(htmlBytes, luxBytes)
  };
}

function measureCorpus(): Omit<FixtureMeasurement, "name"> {
  const totals = benchmarkCorpus.reduce(
    (acc, fixture) => {
      acc.luxChars += fixture.lux.length;
      acc.luxBytes += byteLength(fixture.lux);
      acc.htmlChars += fixture.html.length;
      acc.htmlBytes += byteLength(fixture.html);
      return acc;
    },
    { luxChars: 0, luxBytes: 0, htmlChars: 0, htmlBytes: 0 }
  );

  return {
    ...totals,
    charRatio: ratio(totals.htmlChars, totals.luxChars),
    byteRatio: ratio(totals.htmlBytes, totals.luxBytes)
  };
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function ratio(numerator: number, denominator: number): number {
  return Number((numerator / denominator).toFixed(3));
}
