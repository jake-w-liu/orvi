# Changelog

## 0.1.9

- Bundled Orvi runtime updated to `orvi-lang` 0.2.2: deep nesting can no longer
  overflow the parser stack (it's reported and capped), a bare list marker on
  its own line is an empty list item (so `orvi format` is idempotent on it), and
  generated tab ids are sanitized. The preview surface is unchanged.

## 0.1.8

- Bundled Orvi runtime updated to `orvi-lang` 0.2.1: the formatter no longer
  mutates a code block nested inside a component (and is idempotent on it), no
  longer inserts a stray space after the code-fence backticks, and `orvi build`
  reports a clear error for `-o` with no value. The preview surface is
  unchanged.

## 0.1.7

- Preview now picks up a sibling `orvi.config.js` even when the editor buffer
  is unsaved (the temp build copy gets the project config copied alongside it).
- Bundled Orvi runtime updated to `orvi-lang` 0.2.0: stricter parser
  (`img:`/`badge:` no longer truncate text containing `|`), the formatter and
  Prettier integration report content loss instead of dropping it silently,
  and the new `orvi version` / `--config` CLI options.

## 0.1.6

- Diagnostics now reflect the unsaved buffer while you type, not just the
  last-saved file (the check now runs against a temp copy of the editor
  contents, like the preview already did).
- Completions no longer pop on every space and newline — they trigger on
  `[`, `:`, `=`, and manual invoke only.
- Bundled runtime picks up the dark-mode code-block contrast fix.

## 0.1.5

- Fix the preview panel: `[tabs]` now lay out with the tab labels in a
  row above the active panel (the bundled stylesheet was rendering
  later tab labels below the content). Bundled runtime also picks up
  the new `orvi view` CLI command.

## 0.1.4

- Update the bundled Orvi runtime: single-column tables are recognized,
  `btn:` splits on the first arrow and keeps spaces in the target,
  unclosed metadata blocks report `ORVI_UNCLOSED_METADATA`, code-fence
  language tokens are sanitized, and `orvi serve` 404s unknown paths.

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
