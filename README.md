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

const ast = parseLux("# Hello");
const html = renderLux("# Hello", { fullDocument: true }).html;
const darkHtml = renderLux("# Hello", {
  fullDocument: true,
  colorScheme: "dark",
}).html;
const formatted = formatLux("[blue] Hi []").formatted;
```

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

## VS Code

Extension scaffold lives in `vscode/lux`.

```sh
cd vscode/lux
npm install -g @vscode/vsce
vsce package
```

## Verification

`npm run verify` runs:

- TypeScript strict check
- Jest tests
- Package build

Tests include parser/renderer/formatter behavior, React export behavior, VS Code
extension JSON, and every fenced `lux` example in `lux-language-guide.md`.
