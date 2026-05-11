# Orvi

Orvi is a strict, human-writable markup language that keeps Markdown-like text
simple while adding native visual scopes, layout components, and semantic
elements.

The name is coined from "ordered visual": Orvi source stays ordered and readable
as text, then renders into visual structure. It is intentionally short for the
CLI, package name, and `.ov` files. This is a product story, not a trademark or
domain-ownership claim.

This repo implements the v0.1 prototype from `orvi-language-guide.md`.
Implementation progress is tracked in the roadmap section of that guide.

## Try Orvi

- **In the browser, no install:** the [Orvi Playground](https://jake-w-liu.github.io/orvi/playground/)
  (editor + live preview).
- **In VS Code:** install [`jake-w-liu.orvi-language`](https://marketplace.visualstudio.com/items?itemName=jake-w-liu.orvi-language)
  (`ext install jake-w-liu.orvi-language`) — syntax highlighting, diagnostics,
  completions, and a preview panel, with the Orvi runtime bundled.
- **CLI / library:** the `orvi` npm package is not published yet — for now
  use it from a clone of this repo (see below). Publishing is wired in
  `.github/workflows/publish-npm.yml`; `docs/release.md` has the steps.

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
npm run build
node dist/cli.js check examples/welcome.ov
node dist/cli.js check examples/welcome.ov --json
node dist/cli.js format examples/welcome.ov
node dist/cli.js format examples/welcome.ov --check
node dist/cli.js build examples/welcome.ov -o examples/welcome.html
node dist/cli.js serve examples/welcome.ov --port 4173
```

`orvi build` and `orvi serve` read `orvi.config.js` beside the input file when it
exists. See `orvi.config.example.js`.

## Library

> `orvi` is not on npm yet. Until it is, consume it from a clone of this
> repo: `npm install && npm run build`, then import from `dist/` (or `src/` in a
> TS project). The API and package layout below are what the published package
> will expose.

```ts
import { formatOrvi, parseOrvi, renderOrvi } from "orvi";
import { renderOrviArtifact } from "orvi/artifact";

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
import { OrviRenderer } from "orvi/react";
import "orvi/orvi-base.css";

export function Page() {
  return <OrviRenderer source="# Hello" />;
}
```

Prettier (once `orvi` is on npm):

```sh
prettier --plugin orvi/prettier-plugin --write "**/*.ov"
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
code --install-extension vscode/orvi/orvi-language-0.1.4.vsix
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
import { renderOrviArtifact } from "orvi/artifact";

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

- TypeScript `--noEmit` check
- fine-tuning corpus sync check
- Jest tests
- playground tests
- root package build
- Prettier fixture format check

Tests include parser/renderer/formatter behavior, React export behavior, VS Code
extension JSON, and every fenced `orvi` example in `orvi-language-guide.md`.
