# Lux Implementation Plan

## Status

| Guide item | Repo status |
| --- | --- |
| Formal grammar/spec | Done: `lux-spec-v0.1.md` |
| Built-in modifiers/components | Done: parser validation + CSS classes |
| Valid/invalid test suite | Done: Jest tests |
| Parser package | Done: `src/parser.ts`, `@lux-lang/lux/parser` |
| HTML renderer | Done: `src/renderer.ts`, `@lux-lang/lux/renderer` |
| Default stylesheet | Done: `src/lux-base.css` |
| Theming API | Done: `lux.config.js` support |
| CLI build/check | Done |
| Live preview server | Done |
| Formatter | Done: `lux format` + Prettier plugin bridge |
| React component | Done: `@lux-lang/lux/react` |
| VS Code syntax highlighting | Scaffold done |
| Prettier plugin | Bridge done, needs real-world Prettier fixture tests |
| Obsidian/GitHub/Claude integrations | Not started |
| Playground | Not started |
| AI corpus/benchmarks | Not started |

## Near-Term Milestones

1. Harden v0.1 parser
   - Add malformed nesting fixtures.
   - Add table width mismatch diagnostics.
   - Add tabs-only-child validation for `[tabs]`.
   - Add source ranges for editor diagnostics.

2. Improve developer tooling
   - Add VS Code diagnostic task through CLI JSON output.
   - Add packaged `.vsix` build script.
   - Add Prettier integration test using the real Prettier CLI.

3. Add browser-facing package
   - Add ESM build.
   - Add React fixture app.
   - Add Playwright render smoke tests.

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
