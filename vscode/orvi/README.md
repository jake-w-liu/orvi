# Orvi Language

VS Code language support for Orvi markup.

Orvi is a coined short name from "ordered visual": ordered source text rendered
into visual structure. The short name keeps the command, package, and `.ov`
file extension compact.

## Features

- `.ov` language registration
- TextMate syntax highlighting
- Snippets for callouts, grids, cards, tabs, buttons, and images
- Completion items for Orvi components, semantic prefixes, modifiers, and metadata
- Diagnostics from the bundled Orvi CLI
- Side-by-side preview from the bundled Orvi renderer

## Requirements

No separate Orvi CLI install is required for normal VS Code use. The extension
ships with the Orvi CLI/runtime used for diagnostics and preview.

## Settings

```json
{
  "orvi.cliPath": "orvi"
}
```

Leave `orvi.cliPath` as `orvi` to use the bundled CLI. Set it only when you
want the extension to use a separate local Orvi CLI build.

## Commands

- `Orvi: Preview` opens a side-by-side rendered preview for the active `.ov`
  file.

## Development

Run the extension from the repo root:

```sh
code --extensionDevelopmentPath="$PWD/vscode/orvi" "$PWD"
```

Package a local `.vsix`:

```sh
npm ci
cd vscode/orvi
npm ci
npm run package
```

Install the packaged extension:

```sh
code --install-extension orvi-language-0.1.1.vsix
```
