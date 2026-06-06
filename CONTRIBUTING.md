# Contributing to Orvi

Thanks for helping improve Orvi. This repo holds the language spec, the
reference parser/renderer/formatter, the CLI, the npm library, and the
VS Code / Obsidian / playground integrations.

## Setup

```sh
npm install
npm run build      # dist/ (CJS + ESM + CLI + CSS)
npm run verify     # the full gate (see below)
```

## The verification gate

`npm run verify` must stay green. It runs, in order:

1. `npm run check` — `tsc --noEmit` (strict, `noUncheckedIndexedAccess`, …)
2. `npm run lint` — ESLint (`typescript-eslint`, type-checked) over `src/`
3. `npm run css:sync:check` — fails if `src/styles.ts` is stale relative to
   `src/orvi-base.css`
4. `npm run finetune:corpus:check` — fails if the fine-tuning corpus is stale
5. `npm test` — Jest (parser/renderer/formatter/CLI/React/integrations/guide)
6. `npm run playground:test`
7. `npm run build`
8. `npm run format:check` — Prettier fixture check

CI additionally runs `npm run test:coverage` (coverage thresholds) and packages
the VS Code extension.

## Where things live

| Path | What |
| ---- | ---- |
| `orvi-spec-v0.1.md` | The canonical grammar (EBNF). The parser must match it. |
| `orvi-language-guide.md` | Design guide + the implementation roadmap ledger. |
| `src/parser.ts` | Tokenizer + AST builder; emits diagnostics, never throws on input. |
| `src/renderer.ts` | AST → semantic HTML + scoped CSS classes; `safeUrl`, HTML escaping. |
| `src/orvi-base.css` | The default stylesheet — **edit this**, then `npm run css:sync`. |
| `src/styles.ts` | Generated from `src/orvi-base.css`. Do not hand-edit. |
| `src/formatter.ts` | `orvi format` + the Prettier printer. Reports loss instead of dropping content. |
| `src/cli.ts` | The `orvi` command. |
| `src/artifact.ts`, `src/react.ts`, `src/prettier-plugin.ts` | Library surfaces. |
| `vscode/orvi/` | VS Code extension (bundles the CLI/runtime via `scripts/prepare-runtime.mjs`). |
| `integrations/obsidian-orvi/` | Obsidian plugin scaffold. |
| `playground/` | Static editor + live preview using the ESM build. |

## Conventions

- **No silent data loss.** If the formatter or a tool can't preserve something,
  it must emit an `ORVI_FORMAT_*` diagnostic (or refuse), not drop it quietly.
- **Fail visibly.** Parser problems are diagnostics with source ranges, not
  exceptions and not silence.
- **Edit `src/orvi-base.css`, not `src/styles.ts`.** Run `npm run css:sync`.
- Add tests for behavior changes (`__tests__/`). Update `orvi-spec-v0.1.md`
  and the roadmap in `orvi-language-guide.md` when the language surface moves.
- Run `npm run lint:fix` and `npm run verify` before opening a PR.

## Stability (post-1.0)

`orvi-lang` is `2.x` and under SemVer — read [`docs/stability.md`](docs/stability.md)
before changing anything user-visible. In short: the public exports and the
`orvi`/`ORVI_*` CLI surface are pinned by tests; a backwards-incompatible change
(removal, renamed export, changed default, non-fix change to rendered HTML or to
the `orvi-*` CSS class names) is a **major** release, and a removal must ship a
deprecation warning in a prior minor first. There is intentionally no plugin
API — the extension points are `parseOrvi` (AST) and `renderOrvi` (HTML).

## Releasing

See `docs/release.md` for the package and editor release runbooks. Package
releases are GitHub-only: `.github/workflows/release.yml` verifies the tag,
builds an npm-compatible tarball with `npm pack`, and uploads it to the GitHub
Release. npm registry publishing is manual-only.
