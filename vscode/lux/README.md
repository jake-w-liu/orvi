# Lux Language

VS Code language support for Lux markup.

## Features

- `.lux` language registration
- TextMate syntax highlighting
- Snippets for callouts, grids, cards, tabs, buttons, images, and badges
- Completion items for Lux components, semantic prefixes, modifiers, and metadata
- Diagnostics from `lux check --json`
- Side-by-side preview from `lux build`

## Requirements

Diagnostics and preview need the Lux CLI on your `PATH`, or a configured
absolute path in `lux.cliPath`.

From the Lux repo:

```sh
npm install
npm run build
npm link
```

Then verify:

```sh
lux check examples/welcome.lux
```

## Settings

```json
{
  "lux.cliPath": "lux"
}
```

If VS Code cannot find `lux`, run `which lux` in your shell and set `lux.cliPath`
to that absolute path.

## Commands

- `Lux: Preview` opens a side-by-side rendered preview for the active `.lux`
  file.

## Development

Run the extension from the repo root:

```sh
code --extensionDevelopmentPath="$PWD/vscode/lux" "$PWD"
```

Package a local `.vsix`:

```sh
cd vscode/lux
npm ci
npm run package
```

Install the packaged extension:

```sh
code --install-extension lux-language-0.1.0.vsix
```
