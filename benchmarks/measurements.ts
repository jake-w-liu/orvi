import { benchmarkCorpus, BenchmarkCorpusFixture } from "./corpus";

export interface FixtureMeasurement {
  name: string;
  orviChars: number;
  orviBytes: number;
  htmlChars: number;
  htmlBytes: number;
  charRatio: number;
  byteRatio: number;
}

export interface CorpusMeasurement {
  fixtureCount: number;
  orviChars: number;
  orviBytes: number;
  htmlChars: number;
  htmlBytes: number;
  charRatio: number;
  byteRatio: number;
}

export function measureFixture(fixture: BenchmarkCorpusFixture): FixtureMeasurement {
  const orviBytes = byteLength(fixture.orvi);
  const htmlBytes = byteLength(fixture.html);

  return {
    name: fixture.name,
    orviChars: fixture.orvi.length,
    orviBytes,
    htmlChars: fixture.html.length,
    htmlBytes,
    charRatio: ratio(fixture.html.length, fixture.orvi.length),
    byteRatio: ratio(htmlBytes, orviBytes)
  };
}

export function measureCorpus(fixtures = benchmarkCorpus): CorpusMeasurement {
  const totals = fixtures.reduce(
    (acc, fixture) => {
      acc.orviChars += fixture.orvi.length;
      acc.orviBytes += byteLength(fixture.orvi);
      acc.htmlChars += fixture.html.length;
      acc.htmlBytes += byteLength(fixture.html);
      return acc;
    },
    { orviChars: 0, orviBytes: 0, htmlChars: 0, htmlBytes: 0 }
  );

  return {
    fixtureCount: fixtures.length,
    ...totals,
    charRatio: ratio(totals.htmlChars, totals.orviChars),
    byteRatio: ratio(totals.htmlBytes, totals.orviBytes)
  };
}

export function createBenchmarkReport(fixtures = benchmarkCorpus): string {
  const measuredAt = "2026-05-11";
  const measurements = fixtures.map(measureFixture);
  const totals = measureCorpus(fixtures);
  const rows = measurements
    .map(
      (measurement) =>
        `| ${measurement.name} | ${measurement.orviChars} | ${measurement.htmlChars} | ${measurement.charRatio.toFixed(
          3
        )}x | ${measurement.orviBytes} | ${measurement.htmlBytes} | ${measurement.byteRatio.toFixed(3)}x |`
    )
    .join("\n");

  return `# Orvi Benchmark Corpus Results

Measured on ${measuredAt} from the deterministic fixtures in \`benchmarks/corpus.ts\`.

The corpus is intentionally "large-ish" rather than synthetic at huge scale: ${totals.fixtureCount} valid Orvi documents covering metadata, headings, inline scopes, lists, grids, callouts, cards, tabs, tables, code fences, images, badges, and buttons. Each fixture is rendered through \`renderOrvi\` in tests and compared with its paired equivalent HTML.

## Summary

| Fixtures | Orvi chars | HTML chars | Char ratio | Orvi bytes | HTML bytes | Byte ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ${totals.fixtureCount} | ${totals.orviChars} | ${totals.htmlChars} | ${totals.charRatio.toFixed(3)}x | ${
    totals.orviBytes
  } | ${totals.htmlBytes} | ${totals.byteRatio.toFixed(3)}x |

## Fixture Measurements

| Fixture | Orvi chars | HTML chars | Char ratio | Orvi bytes | HTML bytes | Byte ratio |
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
