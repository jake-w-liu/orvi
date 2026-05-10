# Lux

Lux is a strict, human-writable markup language that keeps Markdown-like text
simple while adding native visual scopes, layout components, and semantic
elements.

This repo implements the v0.1 prototype from `lux-language-guide.md`.
Implementation progress is tracked in the roadmap section of that guide.

Lux documents may start with optional top-level metadata:

```lux
---
lux: 0.1
title: Example
lang: en
dir: ltr
---
```

`title` feeds full HTML document titles, `lang` is document language metadata,
and `dir` may be `ltr`, `rtl`, or `auto`. Dynamic expressions such as `{name}`
are not part of v0.1 and produce diagnostics outside fenced code blocks.

## Install

```sh
npm install
npm run verify
```

## CLI

```sh
npm run build
node dist/cli.js check examples/welcome.lux
node dist/cli.js check examples/welcome.lux --json
node dist/cli.js format examples/welcome.lux
node dist/cli.js format examples/welcome.lux --check
node dist/cli.js build examples/welcome.lux -o examples/welcome.html
node dist/cli.js serve examples/welcome.lux --port 4173
```

`lux build` and `lux serve` read `lux.config.js` beside the input file when it
exists. See `lux.config.example.js`.

## Library

```ts
import { formatLux, parseLux, renderLux } from "@lux-lang/lux";
import { renderLuxArtifact } from "@lux-lang/lux/artifact";

const ast = parseLux("# Hello");
const html = renderLux("# Hello", { fullDocument: true }).html;
const darkHtml = renderLux("# Hello", {
  fullDocument: true,
  colorScheme: "dark",
}).html;
const formatted = formatLux("[blue] Hi []").formatted;
const artifact = renderLuxArtifact("# Hello", { fullDocument: true });
```

The package supports both CommonJS `require()` and ESM `import` exports.

React:

```tsx
import { LuxRenderer } from "@lux-lang/lux/react";
import "@lux-lang/lux/lux-base.css";

export function Page() {
  return <LuxRenderer source="# Hello" />;
}
```

Prettier:

```sh
prettier --plugin @lux-lang/lux/prettier-plugin --write "**/*.lux"
```

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
deploys the playground, example render, ESM renderer, and Lux artifact schema.

## VS Code

Extension package source lives in `vscode/lux`. It provides syntax highlighting,
snippets, completions, diagnostics through `lux check --json`, and a preview
panel through `lux build`.

```sh
cd vscode/lux
npm ci
npm run package
```

The packaged `.vsix` can be installed with:

```sh
code --install-extension vscode/lux/lux-language-0.1.0.vsix
```

Marketplace publishing is wired through `.github/workflows/publish-vscode.yml`.
Set a repository secret named `VSCE_PAT`, then run the workflow manually.

Safari WebDriver smoke coverage is included, but macOS must allow Safari remote
automation before the test can create a real Safari session.

## Obsidian

The Obsidian plugin scaffold lives in `integrations/obsidian-lux`.

```sh
npm run obsidian:build
```

Then copy `manifest.json`, `main.js`, `styles.css`, `versions.json`, and
`runtime/` into a vault at `.obsidian/plugins/lux/`.

## Benchmarks

The benchmark corpus pins Lux-vs-rendered-HTML character and byte measurements.

```sh
npm test -- --runTestsByPath __tests__/benchmark-corpus.test.ts
```

Current pinned corpus ratio: rendered HTML is `2.259x` the Lux source size.
Report: `docs/benchmarks.md`.

## Artifact Schema

AI and render-surface integrations can use the structured Lux artifact:

```ts
import { renderLuxArtifact } from "@lux-lang/lux/artifact";

const artifact = renderLuxArtifact("# Hello", {
  fullDocument: true,
  includeSource: false,
});
```

Schema: `schemas/lux-artifact.schema.json`.

AI authoring guidance lives in `docs/ai-authoring.md`, with a baseline
model-neutral prompt in `prompts/lux-authoring-system.md`.

## Verification

`npm run verify` runs:

- TypeScript strict check
- Jest tests
- Playground tests
- Package build

Tests include parser/renderer/formatter behavior, React export behavior, VS Code
extension JSON, and every fenced `lux` example in `lux-language-guide.md`.
