# Changelog

## 0.1.3

- Fix `hr`/`br` completions to insert `hr:`/`br:` (the parser requires the
  trailing `:`).
- Complete the modifier completion list: all 12 color names, sizes
  `xs`–`2xl`, and weights `light`/`regular`/`medium`/`bold`.

## 0.1.2

- Add right-click `Orvi: Open Preview` and `Open Preview to the Side` from
  editor and Explorer context menus.
- Add `Cmd/Ctrl+Shift+V` (open) and `Cmd/Ctrl+K V` (open to side) keybindings.
- Allow preview from Explorer right-click without opening the file first.
- Bundle parser fixes: quoted option values with whitespace, value-side quote
  stripping, no spurious modifier errors on plain `[bracket]` text, no
  intraword underscore emphasis (`snake_case_var`), accurate diagnostic line
  for dynamic content in multi-line paragraphs.

## 0.1.1

- Bundle the Orvi CLI/runtime so diagnostics and preview work without a global
  `orvi` command.
- Keep `orvi.cliPath` as an optional override for external CLI builds.

## 0.1.0

- Add `.ov` language registration.
- Add syntax highlighting, snippets, and language configuration.
- Add diagnostics via `orvi check --json`.
- Add completions for Orvi components, semantic prefixes, modifiers, and metadata.
- Add `Orvi: Preview` side-by-side preview panel via `orvi build`.
