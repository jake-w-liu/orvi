import { execFileSync } from "child_process";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import { benchmarkCorpus } from "../benchmarks/corpus";
import { parseLux } from "../src/parser";

interface TrainingRecord {
  schema: string;
  id: string;
  source: string;
  task: string;
  input: string;
  output: string;
  metadata: {
    luxVersion: string;
    outputFormat: string;
    [key: string]: unknown;
  };
}

const root = resolve(__dirname, "..");
const corpusPath = resolve(root, "training/fine-tuning/lux-corpus.jsonl");
const manifestPath = resolve(
  root,
  "training/fine-tuning/lux-corpus.manifest.json",
);

describe("fine-tuning corpus", () => {
  it("keeps generated files in sync with the generator", () => {
    execFileSync(
      process.execPath,
      ["scripts/build-fine-tuning-corpus.mjs", "--check"],
      {
        cwd: root,
        stdio: "pipe",
      },
    );
  });

  it("defines deterministic provider-neutral records from repository surfaces", () => {
    const source = readFileSync(corpusPath, "utf8");
    const records = readRecords(source);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const serialized = JSON.stringify(records).toLowerCase();

    expect(source.endsWith("\n")).toBe(true);
    expect(records).toHaveLength(72);
    expect(new Set(records.map((record) => record.id)).size).toBe(
      records.length,
    );
    expect(records[0]).toMatchObject({
      schema: "lux-training-example-v1",
      id: "benchmark:product-brief:html-to-lux",
      source: "benchmarks/corpus.ts",
      task: "html-to-lux",
      metadata: {
        luxVersion: "0.1",
        outputFormat: "lux",
        fixture: "product-brief",
        sourceKind: "benchmark",
      },
    });
    expect(records[0].output).toBe(benchmarkCorpus[0].lux);
    expect(records.at(-1)).toMatchObject({
      id: "spec:modifier:background:black",
      source: "lux-spec-v0.1.md",
      task: "spec-surface-to-lux",
      metadata: {
        modifierKind: "background",
        token: "bg=black",
      },
    });

    expect(manifest.recordCount).toBe(records.length);
    expect(manifest.sources).toEqual({
      "benchmarks/corpus.ts": 27,
      "examples/welcome.lux": 1,
      "lux-spec-v0.1.md": 44,
    });
    expect(manifest.tasks).toEqual({
      "html-to-lux": 27,
      "prompt-to-lux": 1,
      "spec-surface-to-lux": 44,
    });
    expect(manifest.jsonlSha256).toBe(
      createHash("sha256").update(source).digest("hex"),
    );

    for (const providerName of ["openai", "chatgpt", "claude", "gemini"]) {
      expect(serialized).not.toContain(providerName);
    }
  });

  it("keeps every output parseable as Lux v0.1", () => {
    const records = readRecords(readFileSync(corpusPath, "utf8"));

    for (const record of records) {
      expect(parseLux(record.output).diagnostics).toEqual([]);
    }
  });
});

function readRecords(source: string): TrainingRecord[] {
  return source
    .trimEnd()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TrainingRecord);
}
