import { benchmarkCorpus, BenchmarkCorpusFixture } from "./corpus";

export interface FixtureMeasurement {
  name: string;
  luxChars: number;
  luxBytes: number;
  htmlChars: number;
  htmlBytes: number;
  charRatio: number;
  byteRatio: number;
}

export interface CorpusMeasurement {
  fixtureCount: number;
  luxChars: number;
  luxBytes: number;
  htmlChars: number;
  htmlBytes: number;
  charRatio: number;
  byteRatio: number;
}

export function measureFixture(fixture: BenchmarkCorpusFixture): FixtureMeasurement {
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

export function measureCorpus(fixtures = benchmarkCorpus): CorpusMeasurement {
  const totals = fixtures.reduce(
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
    fixtureCount: fixtures.length,
    ...totals,
    charRatio: ratio(totals.htmlChars, totals.luxChars),
    byteRatio: ratio(totals.htmlBytes, totals.luxBytes)
  };
}

export function createBenchmarkReport(fixtures = benchmarkCorpus): string {
  const measuredAt = "2026-05-11";
  const measurements = fixtures.map(measureFixture);
  const totals = measureCorpus(fixtures);
  const rows = measurements
    .map(
      (measurement) =>
        `| ${measurement.name} | ${measurement.luxChars} | ${measurement.htmlChars} | ${measurement.charRatio.toFixed(
          3
        )}x | ${measurement.luxBytes} | ${measurement.htmlBytes} | ${measurement.byteRatio.toFixed(3)}x |`
    )
    .join("\n");

  return `# Lux Benchmark Corpus Results

Measured on ${measuredAt} from the deterministic fixtures in \`benchmarks/corpus.ts\`.

The corpus is intentionally "large-ish" rather than synthetic at huge scale: ${totals.fixtureCount} valid Lux documents covering metadata, headings, inline scopes, lists, grids, callouts, cards, tabs, tables, code fences, images, badges, and buttons. Each fixture is rendered through \`renderLux\` in tests and compared with its paired equivalent HTML.

## Summary

| Fixtures | Lux chars | HTML chars | Char ratio | Lux bytes | HTML bytes | Byte ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ${totals.fixtureCount} | ${totals.luxChars} | ${totals.htmlChars} | ${totals.charRatio.toFixed(3)}x | ${
    totals.luxBytes
  } | ${totals.htmlBytes} | ${totals.byteRatio.toFixed(3)}x |

## Fixture Measurements

| Fixture | Lux chars | HTML chars | Char ratio | Lux bytes | HTML bytes | Byte ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}
`;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function ratio(numerator: number, denominator: number): number {
  return Number((numerator / denominator).toFixed(3));
}
