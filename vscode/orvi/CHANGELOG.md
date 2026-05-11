# Changelog

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
