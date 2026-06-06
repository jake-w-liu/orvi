# Changelog

All notable changes to the `orvi-lang` package. As of `1.0.0` this project
follows [Semantic Versioning](https://semver.org/): the public API (see
`docs/stability.md`) only changes in a backwards-incompatible way in a major
release, and removals are preceded by a deprecation warning in a prior minor.

## 2.0.4

Patch release for the GitHub Pages artifact path.

- **Pages runtime cleanup:** replace `actions/upload-pages-artifact` with an
  explicit `.site` `artifact.tar` plus `actions/upload-artifact@v7`, removing
  the remaining internal Node 20 artifact-action warning from Pages deploys.

## 2.0.3

Patch release for GitHub Actions runtime cleanup.

- **Artifact action maintenance:** update direct `actions/upload-artifact` usage
  from `v4` to `v7`.
- **Node 24 action runtime:** set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`
  across workflows so remaining JavaScript actions, including the Pages artifact
  path, run on the upcoming GitHub Actions runtime instead of emitting Node 20
  deprecation warnings.

## 2.0.2

Patch release for GitHub-only distribution hardening.

- **npm registry disabled by design:** mark the root package `private: true`,
  add a `prepublishOnly` blocker, and point `publishConfig.registry` at an
  invalid host so accidental `npm publish` attempts fail. GitHub Release
  tarballs created by `npm pack` remain the supported install path.
- **Complete GitHub Release assets:** the tag release workflow now uploads the
  npm-compatible package tarballs, the stable `orvi-lang.tgz` alias, the VS Code
  `orvi-language.vsix`, and an `obsidian-orvi-plugin.zip` bundle.
- **Obsidian bundle fix:** include `versions.json` in both the standalone
  Obsidian package artifact and the GitHub Release zip, matching the documented
  community-store layout.
- **Release verification:** require the browser render smoke during release
  verification with `ORVI_REQUIRE_BROWSER=1`.
- **Workflow maintenance:** update first-party GitHub Actions from
  `actions/checkout@v4` / `actions/setup-node@v4` to `@v6`.

## 2.0.1

Patch release for release infrastructure.

- **GitHub-only releases:** replace the npm-publish-dependent release workflow
  with a GitHub Release workflow that verifies the tag, runs the full suite,
  builds an npm-compatible tarball with `npm pack`, and uploads both
  `orvi-lang-<version>.tgz` and the stable `orvi-lang.tgz` asset.
- **Release docs:** document GitHub Releases as the canonical distribution path
  and keep npm registry publishing manual-only.
- **Package metadata:** sync `package-lock.json` with the 2.x package metadata.
- **Firefox smoke stability:** keep the optional Firefox rendering smoke from
  writing `screenshot.png` into the repository root and skip unavailable
  headless screenshot environments with diagnostics.

## 2.0.0

Major release implementing **Orvi language spec `0.4`** — richer lists. The only
breaking change is the AST shape of `ListNode`; the rendered HTML of existing
flat, single-paragraph lists is unchanged.

**Breaking (AST):** `ListNode.items` changed from `InlineNode[][]` to
`ListItemNode[]`. Each item is now a node with block `children` (so an item can
hold paragraphs, sub-lists, code, components, and quotes) and an optional `task`
flag. New exported types `ListItemNode` and a `ListNode` that also carries
optional `start` (first ordered number) and `loose` (loose vs tight).

*Migration:* read `item.children` instead of treating an item as inline; a tight
single-paragraph item's inline content is `item.children[0].children`. The
runtime function exports (`parseOrvi`, `renderOrvi`, `formatOrvi`, `walk`, …) are
unchanged — only the `ListNode` type changed.

**New language features (spec 0.4):**

- **Nested lists / block content in items** — indentation-based nesting; an
  item's content column is the marker width plus one space (plus the task box).
  Leading tabs expand to 4-column stops; no lazy continuation (an under-indented
  line ends the item); nesting is depth-capped.
- **Loose vs tight** — a blank line between items (or an item's blocks) makes the
  list loose (`<p>`-wrapped items); otherwise tight (inline content directly in
  `<li>`, byte-identical to before). Stored as `ListNode.loose`.
- **Ordered `start`** — an ordered list keeps its first number (`<ol start>`),
  stored as `ListNode.start`; the formatter renumbers sequentially from it.
- **Task lists** — `- [ ]` / `- [x]` render a disabled, accessible checkbox;
  allowed on ordered lists too. Stored as `ListItemNode.task`. New
  `.orvi-task-list` / `.orvi-task` / `.orvi-task-box` styles.

The formatter regenerates indentation canonically (so `orvi format` is a fixed
point), preserves loose/tight/start/task, and reports
`ORVI_FORMAT_LIST_AMBIGUOUS_NESTING` when irregular source indentation would
merge adjacent same-type sub-lists. Round-trip is verified by the property
fuzzer (now with list/blockquote/escape tokens) across tens of thousands of
generated documents; the round-trip guarantees are scoped to documents that
parse without error.

## 1.4.0

Additive minor implementing **Orvi language spec `0.3`** (a backwards-compatible
superset of `0.2`). The parser now also accepts `orvi: 0.3`; a document that uses
no `>` lines renders byte-for-byte identically.

- **Blockquotes** — a run of `>`-prefixed lines is a blockquote. One `>` (and an
  optional following space) is stripped per line and the residual is parsed
  recursively, so a quote may contain paragraphs, lists, code blocks, components,
  and nested `> >` quotes. There is no lazy continuation (every line carries its
  `>`; a line without `>` ends the quote), and nesting is depth-capped. Renders
  `<blockquote class="orvi-quote">`; the formatter canonicalizes each level to
  `> ` and escapes a literal leading `>` in paragraph text. New `BlockquoteNode`
  AST type (additive to the `BlockNode` union — no existing export changed) and
  `.orvi-quote` style.

## 1.3.0

Additive minor implementing **Orvi language spec `0.2`** (a backwards-compatible
superset of `0.1`). A document marked `orvi: 0.1` keeps validating; the parser
now also accepts `orvi: 0.2`. The new grammar only adds inline constructs, so a
document that uses none of the new characters renders byte-for-byte identically.

Markdown-parity additions ("if you can write it in Markdown, Orvi should feel
identical — never a wall"):

- **Backslash escaping** — `\*`, `` \` ``, `\[`, … render the literal character.
  A backslash before a non-punctuation character stays literal (CommonMark rule).
- **Inline code spans** — `` `code` `` renders `<code class="orvi-code-inline">`;
  the content is verbatim (no inner markup) and HTML-escaped. New `.orvi-code-inline`
  style. New AST node `inlineCode`.
- **Single-asterisk emphasis** — `*italic*` is an alias of `_italic_` (both
  `<em>`). Emphasis now uses Markdown-style flanking, so `2 * 3 * 4` and
  `a _ b _ c` stay literal. `EmphasisNode` gains an optional `marker` field so
  the formatter re-emits the original delimiter.
- **Hard line breaks** — a line ending in a backslash becomes `<br>`. New AST
  node `hardBreak`.
- **Bare autolinks** — a bare `http(s)://…` URL becomes a link (trailing sentence
  punctuation trimmed, balanced parens kept). Only `http`/`https` are autolinked
  (never bare emails or `javascript:`). `LinkNode` gains an optional `auto` flag
  so the formatter re-emits the bare URL.
- **Table column alignment** — `:---`, `:--:`, `---:` divider cells set per-column
  alignment, rendered with `.orvi-align-left|center|right` classes. `TableNode`
  gains an optional `aligns` array. (Previously these colon markers parsed but
  were silently dropped.)

Correctness, security, and robustness fixes from a full audit:

- **Linear inline parsing** — the inline scanner is single-pass; adversarial
  bracket/asterisk/underscore inputs that were super-linear (e.g.
  `'[red]'.repeat(4000)`) now parse in linear time.
- **`walk()` is iterative** — the public traversal helper no longer recurses, so
  a deep transformer-built AST cannot overflow the stack.
- **Render-time class validation** — an invalid `callout`/`badge` `type` or
  `card bg` can no longer inject extra CSS class tokens; it falls back to the
  default.
- **Block-boundary fixes** — a paragraph immediately before a table is no longer
  absorbed into it, and a single-cell `| Note |` over a bare `---` is parsed as a
  paragraph plus a thematic break (the `---` is not eaten).
- **Formatter round-trip** — literal inline-significant characters are re-escaped,
  and a badge whose text would re-parse as options now emits an
  `ORVI_FORMAT_BADGE_VALUE_DROPPED` warning instead of silently changing content.
- **`orvi serve` hardening** — live reload survives editor atomic-rename saves
  (watches the directory), the server reports `EADDRINUSE` cleanly, the file
  watcher has an error handler, the SSE stream sends a keep-alive heartbeat, and
  `orvi.config.js` is re-read per request so edits take effect without a restart.

Additional fixes from a follow-up deep bug hunt (round-trip / parse correctness):

- The formatter escapes a paragraph line that begins with a block marker
  (`#`, `-`, `1.`, `---`, `//`, `name:`) and neutralizes a literal `http(s)://`
  in text, so neither silently re-parses as a different block or autolink.
- A bare autolink no longer absorbs a following literal character (e.g. an
  escaped `\#`/`\|`) on re-parse; pipes are excluded from autolink URLs.
- Table cells honor `\|` and inline-code spans containing `|` (the splitter is
  code-span- and escape-aware on both the parse and format sides).
- A divider-shaped row among table body rows no longer splits one table in two.
- Inline-scope matching is a single linear stack pass: a valid `[mods]…[]` scope
  is matched independent of preceding unclosed openers, and it honors backslash
  escapes and inline-code spans.
- A backslash-escaped emphasis marker (`*a \* b*`) no longer closes the emphasis.
- A link label may contain an escaped `\]` (`[a\]b](url)`); the bracket search
  finds the first unescaped `]`, and the formatter escapes `]` inside a link
  label (only there — global `]` escaping is not idempotent).
- A bare autolink excludes `[ ]` (as well as `\ |`) so it cannot swallow markup
  brackets, which also keeps the bracket-based scope matcher unconfused.
- Block-marker escaping is applied per inline node (paragraph start / after a
  hard break), so a newline inside a multi-line inline-code span is never
  mistaken for a new block line and its content stays verbatim.
- Table-cell `|`-escaping and splitting both skip backslash-escaped backticks,
  so an escaped backtick plus a pipe in a cell round-trips.

These round-trip fixes were driven by adding backslash, escape-sequence, and
URL tokens to the property fuzzer, which now runs clean across tens of
thousands of generated documents.

No public JS export was added or removed (the new AST nodes are matched inside
existing switch statements), so this remains a minor.

## 1.2.0

Additive minor — existing behavior and the rendered output of existing input
are unchanged when the new options are not used.

- **`renderOrvi(source, { renderNode })`** — override the HTML for a block-level
  node. The hook gets `(node, defaultRender)`; return a string to use it
  verbatim, or `undefined` to fall back. `defaultRender(node)` renders the
  built-in way with no hook re-entry, so a hook can wrap or post-process the
  default output. Together with `walk()` over the AST, this is the supported
  extension model — Orvi still has no plugin API by design (see
  `docs/stability.md`). Exported type `RenderNodeHook`.
- **`renderOrvi(source, { sourceLocations: true })`** — every block-level
  element (including nested ones, e.g. a paragraph inside a callout) carries a
  `data-orvi-loc="line:column"` attribute pointing at its source position. Off
  by default; intended for editor click-to-source / scroll-sync. The attribute
  value is escaped; a malformed AST without `loc` simply omits it.
- No parser, formatter, or default-rendering changes.

## 1.1.0

Additive minor — existing documents and the rendered output of existing input
are unchanged.

- **Inline links — `[text](href)`.** A bracketed run *immediately* followed by
  `(href)` is now an inline hyperlink, e.g. `See [the docs](https://example.com).`
  The link text is parsed as inline markup, so `[**bold** link](url)` works.
  This never shadows an `[modifiers]…[]` scope: it is a link only when the
  bracket content is *not* a valid modifier list — so `[red](x)` is still the
  scope opener `[red]` followed by the text `(x)`, exactly as before. The href
  goes through the same `safeUrl` sanitizing as `btn:`/`img:` (non-`http(s)`/
  `mailto`/`tel` schemes are neutralized) and is HTML-attribute-escaped. The
  href is taken up to the first `)`; URLs containing `)` must be percent-encoded.
  Renders as `<a class="orvi-link" …>`; `orvi-base.css` styles `.orvi-link`.
  `orvi format` round-trips links and is idempotent on them.
- **`walk(node, visit)`** — a depth-first AST traversal, exported from
  `orvi-lang` (and the AST types it needs, `OrviNode`). This is the supported
  way to build custom output/analysis on top of Orvi (there is no plugin API by
  design — see `docs/stability.md`). Pure; tolerates a partially malformed AST.
- New AST node `LinkNode` (`{ type: "link"; href: string; children: InlineNode[] }`),
  added to the `InlineNode` union.
- `examples/showcase.ov` gains an inline link; `orvi-spec-v0.1.md` and the
  language guide document the syntax.

## 1.0.0 — Stable

`orvi-lang` is now 1.0: the parser, AST, HTML renderer, formatter, CLI, React
binding, Prettier plugin, artifact format, and default stylesheet are a stable
API under Semantic Versioning. See `docs/stability.md` for exactly what is
covered, the deprecation policy, the language-spec version (`orvi: 0.1`, which
versions independently of the package), and the supported Node range.

No code changes from `0.2.4` — this release is the stability commitment plus:

- **Docs:** `docs/stability.md` (SemVer policy, frozen public surface,
  deprecation process, spec versioning, supported runtimes, security/
  maintainership notes). README and `CONTRIBUTING.md` link to it; the README no
  longer describes the package as a "prototype".
- **Extension model, stated:** Orvi v1 intentionally has no plugin/extension
  API. The extension points are the published functions — consume the AST from
  `parseOrvi`, or post-process the HTML from `renderOrvi`. A plugin API may
  arrive in a future major if there is demand.
- **Perf gate:** `__tests__/perf.test.ts` parses and renders a large synthetic
  document under a fixed time budget, so a major performance regression fails
  CI.
- **Browser correctness, enforced:** the headless-Chrome render smoke now *fails*
  (rather than skips) when `ORVI_REQUIRE_BROWSER` is set, and CI sets it on the
  coverage job — so "the generated HTML renders correctly in a real browser" is
  checked on every CI run, not just opportunistically.

## 0.2.4 — Industrial release engineering

- **Packaging:** `package.json` now declares `engines.node` (`>=20`),
  `sideEffects: false` (safe — every published module is pure; the `orvi` CLI
  bin is unaffected), and marks the `react` peer dependency `optional`. The main
  entry (`orvi-lang` / `require("orvi-lang")`) no longer re-exports the React
  binding, so it has no `react` dependency — import `OrviRenderer` from
  `orvi-lang/react` instead (the documented path; the exports map is unchanged).
- **Public API surface:** a test pins the runtime exports of every published
  entry point and checks each exports-map subpath ships a declaration file, so
  an accidental addition/removal to the public surface fails CI.
- **Release automation:** pushing a `v<version>` tag now publishes that version
  to npm (the tag must match `package.json`) and cuts a GitHub Release with the
  matching `CHANGELOG.md` section (`scripts/extract-changelog.mjs`). The manual
  `workflow_dispatch` path is unchanged.
- **CI hardening:** `verify` now runs on a Node 20 / 22 / 24 matrix, a new
  `audit` job runs `npm audit --audit-level=high` on the root and the VS Code
  extension, and a `.github/dependabot.yml` keeps GitHub Actions and npm
  dependencies (root + `vscode/orvi`) current.
- **Property tests:** the ad-hoc fuzzing used during hardening is now an in-repo,
  CI-run `fast-check` suite — parser/renderer/formatter never throw, the renderer
  never emits a live `<script>`, the formatter is idempotent, and formatting
  never changes what a document renders to when it reports no content loss.
- **Obsidian:** a `package-obsidian` workflow builds the plugin and uploads the
  community-store bundle (`manifest.json`, `main.js`, `styles.css`, `runtime/`)
  as an artifact; `scripts/set-obsidian-version.mjs` bumps `manifest.json` and
  `versions.json` together.
- No changes to the parser, renderer, formatter, or CLI behavior.

## 0.2.3

- **Formatter / parser:** `orvi format` no longer changes what a document
  renders to. A bare `#`–`######` marker on its own line is now an empty heading
  (matching common Markdown), so `# \nfoo` parses as "empty H1, then a paragraph
  `foo`" — previously the paragraph's joined text was `# foo`, which re-parsed as
  an H1, i.e. formatting silently turned a paragraph into a heading. Empty
  headings format as just the hashes. (Verified by fuzzing: 0 render-drift over
  120k random inputs.)
- **Renderer hardening (`renderToHtml`):** clamps a heading node's `depth` to
  1..6 so the output is always valid HTML; HTML-escapes inline-modifier class
  names so a hostile modifier value can't break out of the `class` attribute;
  and tolerates a partially malformed AST (null/undefined `children`, `options`,
  `items`, …) instead of throwing.
- **Parser:** a nonsensical `maxNestingDepth` option (`NaN`, `Infinity`,
  negative) is ignored (falls back to the default) so the nesting cap can't be
  disabled by a bad config.
- **CLI:** `orvi serve` returns a 500 instead of crashing if the watched file is
  removed mid-session.

## 0.2.2

- **Parser hardening:** pathologically deep nesting no longer overflows the
  stack. A component nested past `maxNestingDepth` (default 8) is reported with
  `ORVI_MAX_NESTING_DEPTH` and its body is skipped (not recursed into); inline
  scope/emphasis nesting is capped at depth 24, beyond which the rest of the run
  is kept as literal text with the same diagnostic. `parseOrvi`/`renderOrvi`/
  `formatOrvi` now stay within their "diagnostics, never throw" contract on
  adversarial input (verified by fuzzing).
- **Lists:** a bare list marker on its own line (`-`, `*`, `1.`) is now an empty
  list item, matching common Markdown behavior. As a result `orvi format` is
  idempotent on a paragraph whose first source line is a bare marker (it used to
  produce `* foo` which re-parsed as a list, then `- foo` on a second pass).
  Empty list items format as just the marker (no trailing space).
- **Renderer:** `RenderOptions.idPrefix` is sanitized to id-safe characters
  internally, so it can't break out of a generated attribute regardless of what
  a caller passes.

## 0.2.1

### Fixes

- **Formatter:** a fenced code block nested inside a component is no longer
  mutated — only the two fence lines pick up the component indentation, the
  code text stays verbatim, so `orvi format` is idempotent on it (previously a
  re-format added a level of indentation to the code each time). `orvi format`
  (and the Prettier plugin) also no longer insert a stray space between the
  opening backticks and the language token — a fence's opening line is the
  three backticks immediately followed by the language/filename metadata,
  matching the spec's examples.
- **Renderer / React:** `RenderOptions.idPrefix` lets a caller scope generated
  ids and form-control names (the `[tabs]` radio groups); `OrviRenderer` now
  passes a per-instance prefix via `React.useId()`, so two `<OrviRenderer>` on
  one page no longer share a tab radio group.
- **CLI:** `orvi build … -o` (or `--output`) with no following value is now a
  clear error instead of silently falling back to the default path.

### Tooling / docs

- New `examples/showcase.ov` — one document that renders every v0.1 construct
  (all colors/sizes/weights/backgrounds, every callout type, grids, cards, tabs,
  every semantic line incl. pipes in `img:` alt text and `badge:` labels, code
  blocks — including one nested in a component — single- and multi-column
  tables, lists, metadata). The other examples are reformatted to canonical
  output; `npm run format:check` now covers every `examples/*.ov`, and
  `__tests__/examples.test.ts` pins them parse-clean and canonically formatted.
- ESLint now also lints the build scripts (`scripts/*.mjs`), not just `src/`.
- `npm run build` cleans `dist/` first (reproducible builds); the ESM build no
  longer emits a broken `dist/esm/cli.js` (the CLI is CommonJS-only by design).
- `tsconfig.json` moved off the deprecated `moduleResolution: "node"` to
  `module`/`moduleResolution: "node16"` (same CommonJS output, no behavior
  change).
- Dropped the redundant `IMPLEMENTATION_PLAN.md` (the roadmap lives in
  `orvi-language-guide.md`); refreshed `docs/release.md`.

## 0.2.0 — Industrial hardening

### Tooling & quality gates

- Added ESLint (flat config, `typescript-eslint` type-checked rules) over
  `src/`. `npm run lint` runs it, and it is part of `npm run verify` and CI.
- Added a Jest coverage gate (`npm run test:coverage`) with per-metric
  thresholds, run as its own CI job.
- Tightened `tsconfig.json`: `noUncheckedIndexedAccess`, `noUnusedLocals`,
  `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
  `noImplicitOverride`. Tests compile against a relaxed `tsconfig.test.json`.
- `src/orvi-base.css` is now the single source of truth for the inlined
  default stylesheet. `src/styles.ts` is generated by `npm run css:sync`, and
  `npm run css:sync:check` (part of `verify`) fails if the two ever drift.

### CLI

- `orvi version` / `orvi --version` / `orvi -v` print the package version;
  `orvi help` / `orvi --help` / `orvi -h` print usage.
- New `--config <path>` flag for `orvi build`, `orvi view`, and `orvi serve`
  to point at an explicit `orvi.config.js`. A missing `--config` file is a
  clear error rather than a silent fall-through.
- The positional input file is now detected even when it follows a flag.

### Library

- Formatter: emits `ORVI_FORMAT_METADATA_DROPPED` when reformatting would drop
  an unrecognized top-level metadata key (previously dropped silently).
- Prettier plugin: refuses to reformat (throws) when the document has parse
  errors or when formatting would lose content (comment lines, unrecognized
  metadata), instead of silently deleting it.
- Parser: `img:` keeps everything after the first `|` as alt text, so alt text
  may itself contain `|`. `badge:` keeps everything except a trailing
  `| key=value …` segment as the badge text, so badge text may contain `|`.
  Both round-trip through the formatter.
- React: `OrviRenderer` memoizes its render result, so `onDiagnostics` no
  longer fires on every re-render.

### Repo

- Added a root `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`, and this
  changelog. `CHANGELOG.md` is now part of the published package.

## 0.1.x — Early prototype releases

The v0.1 prototype line — parser, AST, HTML renderer, default stylesheet and
theming, CLI (`build`/`view`/`serve`/`check`/`format`), formatter and Prettier
bridge, React component and ESM build, AI artifact output and JSON schema, the
VS Code extension, the Obsidian plugin scaffold, the GitHub Pages playground,
and the first npm publish as `orvi-lang` — is recorded in the git history and
in the roadmap section of `orvi-language-guide.md`.
