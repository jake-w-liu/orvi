# Orvi Implementation Plan

## Status

`orvi-language-guide.md` is the progress ledger. Keep this file as a concise
implementation companion and avoid drifting from the guide roadmap.

| Guide item                                  | Repo status                                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Formal grammar/spec                         | Done: `orvi-spec-v0.1.md`                                                                                                                  |
| Built-in modifiers/components               | Done: parser validation + CSS classes                                                                                                     |
| Valid/invalid test suite                    | Done: Jest tests                                                                                                                          |
| Parser package                              | Done: `src/parser.ts`, `orvi-lang/parser`                                                                                             |
| AST types                                   | Done: `src/ast.ts`                                                                                                                        |
| HTML renderer                               | Done: `src/renderer.ts`, `orvi-lang/renderer`                                                                                         |
| Default stylesheet                          | Done: `src/orvi-base.css`                                                                                                                  |
| Theming API                                 | Done: `orvi.config.js` support                                                                                                             |
| Renderer color scheme                       | Done: `colorScheme: "dark"`                                                                                                               |
| Top-level metadata                          | Done: optional `orvi`, `title`, `lang`, and `dir` metadata                                                                                 |
| v0.1 parser decisions                       | Done: nesting limit, unsupported dynamic expression diagnostics, metadata validation, `img` alt requirement                               |
| Accessibility-oriented markup               | Done: semantic HTML, image alt validation, callout roles/labels, tabs ARIA                                                                |
| CLI build/check/format                      | Done                                                                                                                                      |
| CLI JSON diagnostics                        | Done: `orvi check --json`, `orvi format --check --json`                                                                                     |
| CLI live preview server                     | Done: `orvi serve` with hot reload                                                                                                         |
| Formatter                                   | Done: `orvi format` + Prettier plugin bridge                                                                                               |
| React component                             | Done: `orvi-lang/react`                                                                                                               |
| VS Code syntax highlighting/snippets/config | Done                                                                                                                                      |
| VS Code diagnostics                         | Done: extension uses bundled Orvi CLI by default                                                                                           |
| VS Code package/release prep                | Done: extension `npm run package`, bundled runtime, package metadata, README, changelog, license, package lock, `.vscodeignore`            |
| VS Code Marketplace publish                 | Done: live v0.1.0 release; v0.1.1 VSIX prepared locally with bundled CLI; manual Marketplace upload remains the supported update path      |
| VS Code autocomplete/live preview           | Done                                                                                                                                      |
| CI                                          | Done: GitHub Actions runs root verify and VS Code package check                                                                           |
| Prettier plugin                             | Bridge done with basic Prettier CLI coverage                                                                                              |
| Browser rendering verification              | Conditional local smoke coverage: Firefox launch, Chrome DOM, and Safari WebDriver; tests skip when a browser or automation is unavailable |
| ESM package build                           | Done: `dist/esm` import exports                                                                                                           |
| React fixture app                           | Done: fixture app + conditional Chrome browser smoke coverage                                                                             |
| Obsidian/GitHub/AI artifact integrations    | Done: Obsidian scaffold, AI artifact, GitHub Pages rendering                                                                              |
| AI artifact support                         | Done: `orvi-lang/artifact` export + JSON schema                                                                                       |
| GitHub rendering                            | Done: GitHub Pages renders repo `.ov` files as HTML previews; native GitHub repo preview requires platform support                       |
| Playground                                  | Done: static editor + preview split + Pages deploy workflow; custom domain gated until DNS is correct                                     |
| AI corpus/benchmarks                        | Done: larger deterministic corpus + token-ish efficiency tests + published report                                                         |
| AI authoring guidance                       | Done: model-neutral prompt and repair workflow; fine-tune pending external model/provider                                                 |

## Near-Term Milestones

1. Harden v0.1 parser
   - Done: add malformed nesting coverage and enforce the default maximum component nesting depth of 8.
   - Done: add table width mismatch diagnostics.
   - Done: add tabs-only-child validation for `[tabs]`.
   - Done: reject unknown components, unsupported options, and unsupported positional arguments.
   - Done: reject unsupported dynamic expressions outside fenced code blocks.
   - Done: validate optional top-level metadata: `orvi: 0.1`, `title`, `lang`, and `dir: ltr|rtl|auto`.
   - Done: require `img` alt text.
   - Done: add source ranges for editor diagnostics.

2. Improve developer tooling
   - Done: add CLI JSON output for editor diagnostics.
   - Done: add VS Code diagnostics using CLI JSON output.
   - Done: add VS Code completions for components, modifiers, semantic prefixes, and metadata.
   - Done: add VS Code preview panel using `orvi build`.
   - Done: add packaged `.vsix` build script.
   - Done: prepare VS Code release metadata, README, changelog, license, package lock, and `.vscodeignore`.
   - Done: add token-backed Marketplace publish workflow.
   - Done: add token-free VSIX package workflow for manual Marketplace/GitHub Release distribution.
   - Done: add Open VSX publish workflow gated by `OVSX_PAT`.
   - Done: add Prettier integration test using the real Prettier CLI.
   - Done: add GitHub Actions CI for `npm run verify` and VS Code package smoke.

3. Add browser-facing package
   - Done: add ESM build.
   - Done: add React fixture app and browser smoke coverage.
   - Done: add Firefox headless launch smoke test for generated HTML.
   - Done: add Chrome headless DOM render smoke test.
   - Done: add Safari WebDriver render smoke harness.
   - Done: add Safari WebDriver DOM render smoke coverage; it runs when Safari remote automation is enabled on the host machine.

4. Build playground
   - Done: editor + preview split view.
   - Done: GitHub Pages deployment workflow.
   - Done: gate `orvi.dev` custom-domain deployment behind `ORVI_PAGES_CNAME`.
   - Optional future: example gallery.
   - Optional future: shareable encoded document state.
   - Optional external branding: register `orvi.dev`, point DNS to the GitHub Pages site, enable the custom domain, and wait for HTTPS certificate issuance.

5. Benchmark corpus
   - Done: add small deterministic Orvi corpus.
   - Done: expand to a larger deterministic Orvi corpus.
   - Done: pin byte/character efficiency ratio against rendered HTML.
   - Done: publish benchmark results in `docs/benchmarks.md`.
   - Done: add model-neutral AI authoring prompt and repair guidance.
   - Fine-tune a model on an Orvi corpus when a target model/provider is chosen.

6. Integrations
   - Done: add native Orvi artifact JSON output and schema for render surfaces.
   - Done: render repo `.ov` files to HTML through GitHub Pages.
   - Done: build Obsidian plugin scaffold.
   - Done: document that native GitHub `.ov` rendering requires GitHub platform support.

## Acceptance Gate

Every milestone must keep:

```sh
npm run verify
node dist/cli.js check examples/welcome.ov
node dist/cli.js build examples/welcome.ov -o examples/welcome.html
```

green.
