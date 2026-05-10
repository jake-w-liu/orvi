# Lux Implementation Plan

## Status

`lux-language-guide.md` is the progress ledger. Keep this file as a concise
implementation companion and avoid drifting from the guide roadmap.

| Guide item | Repo status |
| --- | --- |
| Formal grammar/spec | Done: `lux-spec-v0.1.md` |
| Built-in modifiers/components | Done: parser validation + CSS classes |
| Valid/invalid test suite | Done: Jest tests |
| Parser package | Done: `src/parser.ts`, `@lux-lang/lux/parser` |
| AST types | Done: `src/ast.ts` |
| HTML renderer | Done: `src/renderer.ts`, `@lux-lang/lux/renderer` |
| Default stylesheet | Done: `src/lux-base.css` |
| Theming API | Done: `lux.config.js` support |
| Renderer color scheme | Done: `colorScheme: "dark"` |
| Top-level metadata | Done: optional `lux`, `title`, `lang`, and `dir` metadata |
| v0.1 parser decisions | Done: nesting limit, unsupported dynamic expression diagnostics, metadata validation, `img` alt requirement |
| Accessibility guarantees | Done: semantic HTML, image alt validation, callout roles/labels, tabs ARIA |
| CLI build/check/format | Done |
| CLI JSON diagnostics | Done: `lux check --json`, `lux format --check --json` |
| CLI live preview server | Done: `lux serve` with hot reload |
| Formatter | Done: `lux format` + Prettier plugin bridge |
| React component | Done: `@lux-lang/lux/react` |
| VS Code syntax highlighting/snippets/config | Done |
| VS Code diagnostics | Done: extension runs `lux check --json` |
| VS Code package script | Done: extension `npm run package` |
| VS Code autocomplete/live preview | Not started |
| Prettier plugin | Bridge done with basic Prettier CLI coverage |
| Browser rendering verification | Firefox headless launch smoke done; Chrome/Safari not started |
| ESM package build | Done: `dist/esm` import exports |
| Obsidian/GitHub/AI artifact integrations | Not started |
| Playground | Not started |
| AI corpus/benchmarks | Not started |

## Near-Term Milestones

1. Harden v0.1 parser
   - Done: add malformed nesting coverage and enforce the default maximum component nesting depth of 8.
   - Done: add table width mismatch diagnostics.
   - Done: add tabs-only-child validation for `[tabs]`.
   - Done: reject unknown components, unsupported options, and unsupported positional arguments.
   - Done: reject unsupported dynamic expressions outside fenced code blocks.
   - Done: validate optional top-level metadata: `lux: 0.1`, `title`, `lang`, and `dir: ltr|rtl|auto`.
   - Done: require `img` alt text.
   - Done: add source ranges for editor diagnostics.

2. Improve developer tooling
   - Done: add CLI JSON output for editor diagnostics.
   - Done: add VS Code diagnostics using CLI JSON output.
   - Done: add packaged `.vsix` build script.
   - Done: add Prettier integration test using the real Prettier CLI.

3. Add browser-facing package
   - Done: add ESM build.
   - Add React fixture app.
   - Done: add Firefox headless launch smoke test for generated HTML.
   - Add Chrome and Safari render smoke tests.

4. Build playground
   - Editor + preview split view.
   - Example gallery.
   - Shareable encoded document state.

## Acceptance Gate

Every milestone must keep:

```sh
npm run verify
node dist/cli.js check examples/welcome.lux
node dist/cli.js build examples/welcome.lux -o examples/welcome.html
```

green.
