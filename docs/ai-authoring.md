# Lux AI Authoring Guidance

Lux is designed to be easy for AI systems to emit because the language has one
strict v0.1 surface and no raw HTML fallback.

Use `prompts/lux-authoring-system.md` as the baseline system prompt for models
or agents that need to write Lux. The prompt is model-neutral and should work in
any assistant, agent, or render-surface pipeline.

## Recommended Generation Flow

1. Ask for the target document type, audience, and required components.
2. Generate Lux only.
3. Run `lux check --json`.
4. Repair diagnostics by code and source range.
5. Run `lux format`.
6. Render with `renderLux` or `renderLuxArtifact`.

## Repair Rules

- `LUX_UNKNOWN_COMPONENT`: replace the component with one of `callout`, `grid`,
  `card`, `tabs`, or `tab`.
- `LUX_UNKNOWN_OPTION`: remove the option or replace it with a documented
  option for that component.
- `LUX_GRID_COLUMN_MISMATCH`: adjust `[grid N]` or the `---` separators.
- `LUX_INVALID_TABLE`: make every table row the same width as the header.
- `LUX_UNSUPPORTED_DYNAMIC_EXPRESSION`: put the expression in a fenced code
  block or write literal text.
- `LUX_IMG_ALT_REQUIRED`: add `| descriptive alt text` to the image line.

## Example Output

```lux
---
lux: 0.1
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

For future fine-tuning, store examples as JSONL:

```json
{"input":"Create a two-column launch brief with a success badge.","output":"---\nlux: 0.1\ntitle: Launch Brief\nlang: en\n---\n\n# Launch Brief\n\nbadge: Ready | type=success\n"}
```

Keep outputs valid under `lux check`, and include a mix of simple documents,
component-heavy layouts, invalid-to-valid repairs, and benchmark-like paired
Lux/HTML examples.
