# Orvi

[![Verify](https://github.com/jake-w-liu/orvi/actions/workflows/verify.yml/badge.svg)](https://github.com/jake-w-liu/orvi/actions/workflows/verify.yml)
[![Release](https://img.shields.io/github/v/release/jake-w-liu/orvi?sort=semver)](https://github.com/jake-w-liu/orvi/releases)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Orvi is a strict, human-writable markup language that keeps Markdown-like text
simple while adding native visual scopes, layout components, and semantic
elements.

The name is coined from "ordered visual": Orvi source stays ordered and readable
as text, then renders into visual structure. It is short for the CLI command
(`orvi`) and `.ov` files; the npm package is `orvi-lang` (the bare name `orvi` is
rejected by npm's similarity guard). This is a product story, not a trademark or
domain-ownership claim.

This repo implements the Orvi `v0.4` language (`orvi-spec-v0.4.md`, a
backwards-compatible superset of the earlier specs;
`orvi-language-guide.md`). The `orvi-lang` package follows
[Semantic Versioning](https://semver.org/) — see
[`docs/stability.md`](docs/stability.md).

## Try Orvi

- **In the browser, no install:** the [Orvi Playground](https://jake-w-liu.github.io/orvi/playground/)
  (editor + live preview).
- **In VS Code:** install [`jake-w-liu.orvi-language`](https://marketplace.visualstudio.com/items?itemName=jake-w-liu.orvi-language)
  (`ext install jake-w-liu.orvi-language`) — syntax highlighting, diagnostics,
  completions, and a preview panel, with the Orvi runtime bundled.
- **CLI / library:** install the latest GitHub Release tarball
  (`npm install https://github.com/jake-w-liu/orvi/releases/latest/download/orvi-lang.tgz`);
  the CLI binary is `orvi`.

Sample documents to read or render live in `examples/` (`getting-started.ov`,
`dashboard.ov`, `welcome.ov`). The GitHub Pages site renders each one and serves
`getting-started.ov` as its landing page.

Orvi documents may start with optional top-level metadata:

```orvi
---
orvi: 0.1
title: Example
lang: en
dir: ltr
---
```

`title` feeds full HTML document titles, `lang` is document language metadata,
and `dir` may be `ltr`, `rtl`, or `auto`. Dynamic expressions such as `{name}`
are not part of v0.1 and produce diagnostics outside fenced code blocks.

## From source

Clone the repo, then:

```sh
npm install
npm run build   # produces dist/ (CJS + ESM + CLI + CSS)
npm run verify  # full check + test + build + format suite
```

## CLI

```sh
npm install -g https://github.com/jake-w-liu/orvi/releases/latest/download/orvi-lang.tgz

orvi view doc.ov                       # render to a temp file and open it in the browser
orvi serve doc.ov                      # live preview with hot reload (Ctrl+C to stop)
orvi build doc.ov                      # write doc.html next to the input (or -o other.html)
orvi check doc.ov [--json]             # validate, print diagnostics
orvi format doc.ov [--write] [--check] # reformat
orvi version                           # print the package version
```

`orvi build`, `orvi view`, and `orvi serve` accept `--config path/to/orvi.config.js`
to override the config file (otherwise they read `orvi.config.js` beside the
input; see `orvi.config.example.js`). From a clone of this repo, the same
commands run via `node dist/cli.js …` after `npm run build`.

## Library

```sh
npm install https://github.com/jake-w-liu/orvi/releases/latest/download/orvi-lang.tgz
```

```ts
import { formatOrvi, parseOrvi, renderOrvi, walk } from "orvi-lang";
import { renderOrviArtifact } from "orvi-lang/artifact";

const ast = parseOrvi("See [the docs](https://example.com).");
const html = renderOrvi("# Hello", { fullDocument: true }).html;
const darkHtml = renderOrvi("# Hello", {
  fullDocument: true,
  colorScheme: "dark",
}).html;
const formatted = formatOrvi("[blue] Hi []").formatted;
const artifact = renderOrviArtifact("# Hello", { fullDocument: true });

// No plugin API by design — walk the AST to build custom output/analysis.
const links: string[] = [];
walk(ast, (node) => {
  if (node.type === "link") links.push(node.href);
});

// Or override the HTML for specific block nodes (defaultRender has no hook re-entry):
const wrapped = renderOrvi("# Title", {
  renderNode: (node, defaultRender) =>
    node.type === "heading" ? `<header>${defaultRender(node)}</header>` : undefined,
}).html;

// Editor integrations: tag every block element with its source position.
const traced = renderOrvi("# Title", { sourceLocations: true }).html; // <h1 data-orvi-loc="1:1">…
```

The package supports both CommonJS `require()` and ESM `import` exports, and
ships an `orvi` CLI bin.

React:

```tsx
import { OrviRenderer } from "orvi-lang/react";
import "orvi-lang/orvi-base.css";

export function Page() {
  return <OrviRenderer source="# Hello" />;
}
```

Prettier:

```sh
prettier --plugin orvi-lang/prettier-plugin --write "**/*.ov"
```

From a clone of this repo, point `--plugin` at the built file
(`./dist/prettier-plugin.js`), as `npm run format:check` does.

## Versioning and stability

`orvi-lang` is `2.x` and follows [Semantic Versioning](https://semver.org/):
the public API changes incompatibly only in a major release, and removals are
preceded by a deprecation warning in a prior minor. The full contract — what is
public, the deprecation policy, the language-spec version (`orvi: 0.4`, which
versions independently of the package), the supported Node range, and the
security and maintainership notes — is in [`docs/stability.md`](docs/stability.md).

The public API surface is the documented exports below — pinned by a test, so
additions and removals are deliberate:

| Import | Provides |
| --- | --- |
| `orvi-lang` | `parseOrvi`, `renderOrvi`, `renderToHtml`, `formatOrvi`, `walk`, `OrviParser`, `defaultCss`, plus the AST/diagnostic types |
| `orvi-lang/parser`, `/renderer`, `/formatter`, `/artifact` | the same functions, scoped |
| `orvi-lang/react` | `OrviRenderer` (requires a `react` peer; the main entry does not) |
| `orvi-lang/prettier-plugin` | the Prettier plugin |
| `orvi-lang/orvi-base.css` | the default stylesheet |

Orvi has no plugin/extension API by design: consume the AST from
`parseOrvi`, or post-process the HTML from `renderOrvi`. Keeping the surface
small is what makes the SemVer guarantee tractable; a plugin API may come in a
future major if there's demand.

The package targets Node `>=20` (`engines.node`), is side-effect-free
(`sideEffects: false`), and ships both CommonJS `require()` and ESM `import`
builds with declaration files for every entry point.

## Playground

The static playground lives in `playground/` and uses the built ESM renderer.

```sh
npm run build
python3 -m http.server 4173
open http://127.0.0.1:4173/playground/
```

Run its focused tests with:

```sh
npm run playground:test
```

`npm run site:build` prepares `.site/` for GitHub Pages. The Pages workflow
deploys the playground, example render, ESM renderer, and Orvi artifact schema.

## VS Code

Extension package source lives in `vscode/orvi`. It provides syntax highlighting,
snippets, completions, diagnostics, and preview. The VSIX bundles the Orvi
CLI/runtime, so users do not need a separate global `orvi` command for normal
editor use.

```sh
cd vscode/orvi
npm ci
npm run package
```

The packaged `.vsix` can be installed with:

```sh
code --install-extension vscode/orvi/orvi-language-0.1.7.vsix
```

Distribution is Azure-free: package the VSIX with `npm run vscode:package` or the
`.github/workflows/package-vscode.yml` artifact, then attach it to a GitHub
Release. Open VSX publishing is wired through
`.github/workflows/publish-open-vsx.yml` after `OVSX_PAT` and the `jake-w-liu`
namespace are configured. There is no VS Code Marketplace automation (it would
require an Azure DevOps token).

Safari WebDriver smoke coverage is included, but macOS must allow Safari remote
automation before the test can create a real Safari session.

## Obsidian

The Obsidian plugin scaffold lives in `integrations/obsidian-orvi`.

```sh
npm run obsidian:build
```

Then copy `manifest.json`, `main.js`, `styles.css`, `versions.json`, and
`runtime/` into a vault at `.obsidian/plugins/orvi/`. The
`.github/workflows/package-obsidian.yml` workflow builds and uploads that
bundle as an artifact (no Azure); `scripts/set-obsidian-version.mjs` bumps
`manifest.json` and `versions.json` together for a release.

## Benchmarks

The benchmark corpus pins Orvi-vs-rendered-HTML character and byte measurements.

```sh
npm test -- --runTestsByPath __tests__/benchmark-corpus.test.ts
```

Current pinned corpus ratio: rendered HTML is `2.298x` the Orvi source size.
Report: `docs/benchmarks.md`.

## Artifact Schema

AI and render-surface integrations can use the structured Orvi artifact:

```ts
import { renderOrviArtifact } from "orvi-lang/artifact";

const artifact = renderOrviArtifact("# Hello", {
  fullDocument: true,
  includeSource: false,
});
```

Schema: `schemas/orvi-artifact.schema.json`.

AI authoring guidance lives in `docs/ai-authoring.md`, with a baseline
model-neutral prompt in `prompts/orvi-authoring-system.md`.

## Verification

`npm run verify` runs:

- TypeScript `--noEmit` check (strict, `noUncheckedIndexedAccess`, …)
- ESLint over `src/` (`typescript-eslint`, type-checked)
- CSS sync check (`src/styles.ts` must match `src/orvi-base.css` — `npm run css:sync` regenerates it)
- fine-tuning corpus sync check
- Jest tests
- playground tests
- root package build
- Prettier fixture format check

CI runs `verify` on a Node 20 / 22 / 24 matrix, plus `npm run test:coverage`
(per-metric coverage thresholds), `npm audit --audit-level=high` (root and the
VS Code extension), and the VS Code extension package smoke. Dependabot
(`.github/dependabot.yml`) keeps GitHub Actions and npm dependencies current.

Tests include parser/renderer/formatter behavior, `fast-check` property tests
(parser/renderer/formatter never throw, the renderer never emits a live
`<script>`, the formatter is idempotent and never changes what a document
renders to when it reports no loss), React export behavior, the published
package surface and tarball contents, VS Code extension JSON, the release
workflows, and every fenced `orvi` example in `orvi-language-guide.md`.
Contributor docs: `CONTRIBUTING.md`. Security notes: `SECURITY.md`. Release
notes and the release runbook: `CHANGELOG.md`, `docs/release.md`.
