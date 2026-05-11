# Orvi

Orvi is a strict, human-writable markup language that keeps Markdown-like text
simple while adding native visual scopes, layout components, and semantic
elements.

The name is coined from "ordered visual": Orvi source stays ordered and readable
as text, then renders into visual structure. It is short for the CLI command
(`orvi`) and `.ov` files; the npm package is `orvi-lang` (the bare name `orvi` is
rejected by npm's similarity guard). This is a product story, not a trademark or
domain-ownership claim.

This repo implements the v0.1 prototype from `orvi-language-guide.md`.
Implementation progress is tracked in the roadmap section of that guide.

## Try Orvi

- **In the browser, no install:** the [Orvi Playground](https://jake-w-liu.github.io/orvi/playground/)
  (editor + live preview).
- **In VS Code:** install [`jake-w-liu.orvi-language`](https://marketplace.visualstudio.com/items?itemName=jake-w-liu.orvi-language)
  (`ext install jake-w-liu.orvi-language`) — syntax highlighting, diagnostics,
  completions, and a preview panel, with the Orvi runtime bundled.
- **CLI / library:** `npm install orvi-lang` (the CLI binary is `orvi`; also
  `npx orvi-lang build doc.ov`). Published with provenance from
  `.github/workflows/publish-npm.yml`.

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
npm install -g orvi-lang   # provides the `orvi` command; or use `npx orvi-lang`

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
npm install orvi-lang
```

```ts
import { formatOrvi, parseOrvi, renderOrvi } from "orvi-lang";
import { renderOrviArtifact } from "orvi-lang/artifact";

const ast = parseOrvi("# Hello");
const html = renderOrvi("# Hello", { fullDocument: true }).html;
const darkHtml = renderOrvi("# Hello", {
  fullDocument: true,
  colorScheme: "dark",
}).html;
const formatted = formatOrvi("[blue] Hi []").formatted;
const artifact = renderOrviArtifact("# Hello", { fullDocument: true });
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
`runtime/` into a vault at `.obsidian/plugins/orvi/`.

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

CI additionally runs `npm run test:coverage` (per-metric coverage thresholds)
and packages the VS Code extension.

Tests include parser/renderer/formatter behavior, React export behavior, VS Code
extension JSON, and every fenced `orvi` example in `orvi-language-guide.md`.
Contributor docs: `CONTRIBUTING.md`. Security notes: `SECURITY.md`. Release
notes: `CHANGELOG.md`.
