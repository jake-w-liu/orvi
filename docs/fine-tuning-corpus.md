# Orvi Fine-Tuning Corpus Preparation

Orvi includes a small, deterministic JSONL corpus for future fine-tuning or
training-data experiments. The corpus is provider-neutral: each line is a plain
`input`/`output` record with metadata, not a provider-specific chat or messages
format.

## Generate

```sh
npm run finetune:corpus
```

This writes:

- `training/fine-tuning/orvi-corpus.jsonl`
- `training/fine-tuning/orvi-corpus.manifest.json`

Use the check mode in CI or release verification when you only want to confirm
that generated files match the repository sources:

```sh
npm run finetune:corpus:check
```

## Sources

The generator reads only committed Orvi surfaces:

- `benchmarks/corpus.ts` for paired rendered-HTML-to-Orvi examples.
- `examples/welcome.ov` for the repository welcome example.
- `orvi-spec-v0.1.md` for built-in components, semantic elements, modifiers,
  and valid snippets derived from those documented tokens.

The generator does not run a fine-tuning job and the generated files should not
be described as model performance results. They are preparation artifacts only.

## Running a Real Fine-Tune

The committed corpus is provider-neutral. A real fine-tune still requires:

- provider and base-model choice
- account/API access
- explicit budget approval
- provider-specific JSONL conversion if required
- upload, job creation, and evaluation

Do not start a fine-tuning job from this repo unless those external choices are
known. After a provider is selected, keep a small evaluation set separate from
the training data and verify generated Orvi with `orvi check`.

## Record Shape

Each JSONL line follows this schema:

```json
{
  "schema": "orvi-training-example-v1",
  "id": "example:id",
  "source": "path/in/repo",
  "task": "prompt-to-orvi",
  "input": "Instruction text",
  "output": "Valid Orvi source",
  "metadata": { "orviVersion": "0.1", "outputFormat": "orvi" }
}
```

Current tasks are:

- `html-to-orvi`
- `prompt-to-orvi`
- `spec-surface-to-orvi`

All outputs are intended to parse cleanly as Orvi v0.1.
