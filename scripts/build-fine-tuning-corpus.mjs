#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Script, createContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const root = dirname(
  fileURLToPath(new URL("../package.json", import.meta.url)),
);
const corpusPath = join(root, "training", "fine-tuning", "orvi-corpus.jsonl");
const manifestPath = join(
  root,
  "training",
  "fine-tuning",
  "orvi-corpus.manifest.json",
);
const corpusSchema = "orvi-training-example-v1";

const sourcePaths = {
  benchmark: join(root, "benchmarks", "corpus.ts"),
  welcomeExample: join(root, "examples", "welcome.ov"),
  spec: join(root, "orvi-spec-v0.1.md"),
};

async function main() {
  const check = process.argv.includes("--check");
  const { jsonl, manifestJson, records } = await buildArtifacts();

  if (check) {
    const [currentJsonl, currentManifest] = await Promise.all([
      readFile(corpusPath, "utf8").catch(() => undefined),
      readFile(manifestPath, "utf8").catch(() => undefined),
    ]);
    const stale = [];
    if (currentJsonl !== jsonl) stale.push(repoPath(corpusPath));
    if (currentManifest !== manifestJson) stale.push(repoPath(manifestPath));

    if (stale.length > 0) {
      console.error(`Fine-tuning corpus is stale: ${stale.join(", ")}`);
      console.error("Run `npm run finetune:corpus` to regenerate it.");
      process.exitCode = 1;
      return;
    }

    console.log(
      `Fine-tuning corpus is up to date (${records.length} records).`,
    );
    return;
  }

  await mkdir(dirname(corpusPath), { recursive: true });
  await Promise.all([
    writeFile(corpusPath, jsonl),
    writeFile(manifestPath, manifestJson),
  ]);
  console.log(`Wrote ${records.length} records to ${repoPath(corpusPath)}.`);
  console.log(`Wrote manifest to ${repoPath(manifestPath)}.`);
}

export async function buildArtifacts() {
  const records = await buildFineTuningCorpus();
  validateRecords(records);
  const jsonl = serializeJsonl(records);
  const manifest = createManifest(records, jsonl);
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;

  return { jsonl, manifestJson, records };
}

export async function buildFineTuningCorpus() {
  const [benchmarkCorpus, welcomeOrvi, specMarkdown] = await Promise.all([
    loadBenchmarkCorpus(),
    readFile(sourcePaths.welcomeExample, "utf8"),
    readFile(sourcePaths.spec, "utf8"),
  ]);
  const spec = parseSpecSurfaces(specMarkdown);
  const records = [];

  for (const fixture of benchmarkCorpus) {
    records.push(
      record({
        id: `benchmark:${fixture.name}:html-to-orvi`,
        source: sourcePaths.benchmark,
        task: "html-to-orvi",
        input: [
          "Convert this rendered Orvi HTML into valid Orvi v0.1 markup.",
          "Keep the structure, components, text, links, and image alt text equivalent.",
          "",
          `Fixture: ${fixture.name}`,
          "",
          "HTML:",
          fixture.html,
        ].join("\n"),
        output: fixture.orvi,
        metadata: {
          fixture: fixture.name,
          sourceKind: "benchmark",
          pairedHtmlChars: fixture.html.length,
        },
      }),
    );
  }

  records.push(
    record({
      id: "example:welcome:prompt-to-orvi",
      source: sourcePaths.welcomeExample,
      task: "prompt-to-orvi",
      input: [
        "Write the repository welcome example as valid Orvi v0.1 markup.",
        "Include the heading, styled intro line, two-column grid, info callout, and call-to-action link.",
      ].join("\n"),
      output: welcomeOrvi,
      metadata: {
        sourceKind: "example",
        fixture: "welcome",
      },
    }),
  );

  for (const component of spec.components) {
    records.push(
      record({
        id: `spec:component:${slug(component)}`,
        source: sourcePaths.spec,
        task: "spec-surface-to-orvi",
        input: `Write a valid Orvi v0.1 snippet using the built-in \`${component}\` component from the specification.`,
        output: componentExample(component),
        metadata: {
          sourceKind: "spec",
          surface: "component",
          token: component,
        },
      }),
    );
  }

  for (const semantic of spec.semantics) {
    records.push(
      record({
        id: `spec:semantic:${slug(semantic)}`,
        source: sourcePaths.spec,
        task: "spec-surface-to-orvi",
        input: `Write a valid Orvi v0.1 snippet using the built-in \`${semantic}:\` semantic element from the specification.`,
        output: semanticExample(semantic),
        metadata: {
          sourceKind: "spec",
          surface: "semantic",
          token: semantic,
        },
      }),
    );
  }

  for (const color of spec.colors) {
    records.push(
      record({
        id: `spec:modifier:color:${slug(color)}`,
        source: sourcePaths.spec,
        task: "spec-surface-to-orvi",
        input: `Write a valid Orvi v0.1 snippet using the \`${color}\` inline color modifier from the specification.`,
        output: colorExample(color),
        metadata: {
          sourceKind: "spec",
          surface: "modifier",
          modifierKind: "color",
          token: color,
        },
      }),
    );
  }

  for (const size of spec.sizes) {
    records.push(
      record({
        id: `spec:modifier:size:${slug(size)}`,
        source: sourcePaths.spec,
        task: "spec-surface-to-orvi",
        input: `Write a valid Orvi v0.1 snippet using the \`${size}\` inline size modifier from the specification.`,
        output: sizeExample(size),
        metadata: {
          sourceKind: "spec",
          surface: "modifier",
          modifierKind: "size",
          token: size,
        },
      }),
    );
  }

  for (const weight of spec.weights) {
    records.push(
      record({
        id: `spec:modifier:weight:${slug(weight)}`,
        source: sourcePaths.spec,
        task: "spec-surface-to-orvi",
        input: `Write a valid Orvi v0.1 snippet using the \`${weight}\` inline weight modifier from the specification.`,
        output: weightExample(weight),
        metadata: {
          sourceKind: "spec",
          surface: "modifier",
          modifierKind: "weight",
          token: weight,
        },
      }),
    );
  }

  for (const color of spec.colors) {
    records.push(
      record({
        id: `spec:modifier:background:${slug(color)}`,
        source: sourcePaths.spec,
        task: "spec-surface-to-orvi",
        input: `Write a valid Orvi v0.1 snippet using the \`bg=${color}\` inline background modifier from the specification.`,
        output: backgroundExample(color),
        metadata: {
          sourceKind: "spec",
          surface: "modifier",
          modifierKind: "background",
          token: `bg=${color}`,
        },
      }),
    );
  }

  return records;
}

async function loadBenchmarkCorpus() {
  const source = await readFile(sourcePaths.benchmark, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const context = createContext({
    exports: module.exports,
    module,
    require,
    console,
  });

  new Script(output, {
    filename: repoPath(sourcePaths.benchmark),
  }).runInContext(context);

  if (!Array.isArray(module.exports.benchmarkCorpus)) {
    throw new Error("benchmarks/corpus.ts did not export benchmarkCorpus.");
  }

  return module.exports.benchmarkCorpus;
}

function parseSpecSurfaces(markdown) {
  const components = extractTableNames(markdown, "Built-In Components");
  const semantics = extractTableNames(markdown, "Built-In Semantic Elements");
  const colors = extractBacktickedList(markdown, "Colors");
  const sizes = extractBacktickedList(markdown, "Sizes");
  const weights = extractBacktickedList(markdown, "Weights");

  assertTokens("components", components, [
    "callout",
    "grid",
    "card",
    "tabs",
    "tab",
  ]);
  assertTokens("semantics", semantics, ["btn", "img", "hr", "br", "badge"]);
  assertTokens("colors", colors, [
    "red",
    "blue",
    "green",
    "gray",
    "muted",
    "yellow",
    "purple",
    "orange",
    "pink",
    "cyan",
    "white",
    "black",
  ]);
  assertTokens("sizes", sizes, ["xs", "sm", "md", "lg", "xl", "2xl"]);
  assertTokens("weights", weights, ["light", "regular", "medium", "bold"]);

  return { components, semantics, colors, sizes, weights };
}

function extractTableNames(markdown, heading) {
  return extractSection(markdown, heading)
    .split("\n")
    .map((line) => /^\|\s*`([^`]+)`\s*\|/.exec(line.trim())?.[1])
    .filter(Boolean);
}

function extractBacktickedList(markdown, label) {
  const match = new RegExp(`${label}:\\s*([\\s\\S]*?)\\.`, "m").exec(markdown);
  if (!match) return [];
  return [...match[1].matchAll(/`([^`]+)`/g)].map((item) => item[1]);
}

function extractSection(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  if (start < 0) throw new Error(`Could not find spec section: ${heading}`);
  const next = markdown.indexOf("\n## ", start + 1);
  return markdown.slice(start, next < 0 ? undefined : next);
}

function assertTokens(label, actual, expected) {
  const missing = expected.filter((token) => !actual.includes(token));
  if (missing.length > 0) {
    throw new Error(
      `Spec ${label} missing expected tokens: ${missing.join(", ")}`,
    );
  }
}

function componentExample(component) {
  switch (component) {
    case "callout":
      return `# Callout Example

[callout type=info]
  Confirm the launch note before publishing.
[/callout]`;
    case "grid":
      return `# Grid Example

[grid 2]
  ## Plan
  - Draft
  - Review
  ---
  ## Ship
  - Publish
  - Measure
[/grid]`;
    case "card":
      return `# Card Example

[card bg=gray]
  ## Decision
  Capture the owner, date, and next checkpoint.
[/card]`;
    case "tabs":
      return `# Tabs Example

[tabs]
  [tab label=Summary]
    The release is ready for review.
  [/tab]
  [tab label=Actions]
    - Notify reviewers
    - Publish notes
  [/tab]
[/tabs]`;
    case "tab":
      return `# Tab Example

[tabs]
  [tab label=Details]
    Tab blocks are valid as direct children of tabs.
  [/tab]
[/tabs]`;
    default:
      throw new Error(`No component example for ${component}.`);
  }
}

function semanticExample(semantic) {
  switch (semantic) {
    case "btn":
      return `# Button Example

btn: Open checklist -> https://example.com/checklist`;
    case "img":
      return `# Image Example

img: ./dashboard.png | Dashboard showing launch metrics`;
    case "hr":
      return `# Horizontal Rule Example

Intro paragraph.

hr:

Follow-up paragraph.`;
    case "br":
      return `# Line Break Example

First line.

br:

Second line.`;
    case "badge":
      return `# Badge Example

badge: Ready | type=success`;
    default:
      throw new Error(`No semantic example for ${semantic}.`);
  }
}

function colorExample(color) {
  return `# ${title(color)} Text

[${color}] ${title(color)} status text for a Orvi document. []`;
}

function sizeExample(size) {
  return `# ${title(size)} Text

[${size}] Size-sensitive text for a Orvi document. []`;
}

function weightExample(weight) {
  return `# ${title(weight)} Weight

[${weight}] ${title(weight)} emphasis for a Orvi document. []`;
}

function backgroundExample(color) {
  return `# ${title(color)} Background

[bg=${color}] Background-highlighted text for a Orvi document. []`;
}

function record({ id, source, task, input, output, metadata }) {
  return {
    schema: corpusSchema,
    id,
    source: repoPath(source),
    task,
    input: input.trimEnd(),
    output: output.trimEnd(),
    metadata: {
      orviVersion: "0.1",
      outputFormat: "orvi",
      ...metadata,
    },
  };
}

function validateRecords(records) {
  const ids = new Set();
  const blockedProviderNames = [/openai/i, /chatgpt/i, /claude/i, /gemini/i];

  for (const item of records) {
    if (!item.id || ids.has(item.id))
      throw new Error(`Duplicate or missing record id: ${item.id}`);
    ids.add(item.id);

    for (const key of [
      "schema",
      "source",
      "task",
      "input",
      "output",
      "metadata",
    ]) {
      if (item[key] === undefined || item[key] === "") {
        throw new Error(`Record ${item.id} is missing ${key}.`);
      }
    }

    const serialized = JSON.stringify(item);
    for (const pattern of blockedProviderNames) {
      if (pattern.test(serialized)) {
        throw new Error(
          `Record ${item.id} contains provider-specific wording.`,
        );
      }
    }
  }
}

function serializeJsonl(records) {
  return `${records.map((item) => JSON.stringify(item)).join("\n")}\n`;
}

function createManifest(records, jsonl) {
  return {
    schema: "orvi-training-corpus-manifest-v1",
    corpusSchema,
    output: repoPath(corpusPath),
    recordCount: records.length,
    jsonlSha256: createHash("sha256").update(jsonl).digest("hex"),
    sources: countBy(records, (item) => item.source),
    tasks: countBy(records, (item) => item.task),
    notes: [
      "Provider-neutral JSONL with input/output records; this is not a provider-specific chat/messages format.",
      "Generated deterministically from repository benchmark, example, and specification surfaces.",
      "This corpus preparation step does not run or claim to run any fine-tuning job.",
    ],
  };
}

function countBy(records, select) {
  const counts = new Map();
  for (const item of records) {
    const key = select(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Object.fromEntries(
    [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function title(value) {
  return value
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function repoPath(path) {
  return relative(root, path).split("\\").join("/");
}

function isEntrypoint() {
  return (
    process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
  );
}

if (isEntrypoint()) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
