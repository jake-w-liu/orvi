# Orvi AI Authoring Guidance

Orvi is designed to be easy for AI systems to emit because the language has one
strict v0.1 surface and no raw HTML fallback.

Use `prompts/orvi-authoring-system.md` as the baseline system prompt for models
or agents that need to write Orvi. The prompt is model-neutral and should work in
any assistant, agent, or render-surface pipeline.

## Recommended Generation Flow

1. Ask for the target document type, audience, and required components.
2. Generate Orvi only.
3. Run `orvi check --json`.
4. Repair diagnostics by code and source range.
5. Run `orvi format`.
6. Render with `renderOrvi` or `renderOrviArtifact`.

## Repair Rules

- `ORVI_UNKNOWN_COMPONENT`: replace the component with one of `callout`, `grid`,
  `card`, `tabs`, or `tab`.
- `ORVI_UNKNOWN_OPTION`: remove the option or replace it with a documented
  option for that component.
- `ORVI_GRID_MISMATCH`: adjust `[grid N]` or the `---` separators.
- `ORVI_TABLE_WIDTH_MISMATCH`: make every table row the same width as the header.
- `ORVI_DYNAMIC_CONTENT_UNSUPPORTED`: put the expression in a fenced code
  block or write literal text.
- `ORVI_INVALID_SEMANTIC`: for `img:` without alt text, add
  `| descriptive alt text` to the image line.

## Example Output

```orvi
---
orvi: 0.1
title: Launch Brief
lang: en
dir: ltr
---

# Launch Brief

badge: Ready | type=success

[grid 2]
  ## Scope
  - Docs
  - Examples
  - Release notes
  ---
  [callout type=info]
    Confirm the final benchmark report before publishing.
  [/callout]
[/grid]

btn: Open release checklist -> https://example.com/release
```

## Fine-Tuning Data Shape

For future fine-tuning, use the committed deterministic corpus instead of
hand-rolled one-off examples:

```sh
npm run finetune:corpus
```

The corpus and schema are documented in `docs/fine-tuning-corpus.md` and written
to `training/fine-tuning/orvi-corpus.jsonl`. Keep outputs valid under
`orvi check`. The committed corpus currently includes prompt-to-Orvi,
spec-surface-to-Orvi, and rendered-HTML-to-Orvi examples; add separate repair
records before using it to train diagnostic-repair behavior.
