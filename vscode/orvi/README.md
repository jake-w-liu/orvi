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
- Diagnostics from `orvi check --json`
- Side-by-side preview from `orvi build`

## Requirements

Diagnostics and preview need the Orvi CLI on your `PATH`, or a configured
absolute path in `orvi.cliPath`.

From the Orvi repo:

```sh
npm install
npm run build
npm link
```

Then verify:

```sh
orvi check examples/welcome.ov
```

## Settings

```json
{
  "orvi.cliPath": "orvi"
}
```

If VS Code cannot find `orvi`, run `which orvi` in your shell and set `orvi.cliPath`
to that absolute path.

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
cd vscode/orvi
npm ci
npm run package
```

Install the packaged extension:

```sh
code --install-extension orvi-language-0.1.0.vsix
```
