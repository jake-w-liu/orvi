# Stability and compatibility

`orvi-lang` is `2.x`. This document is the contract.

## 2.0.0 — list AST change

`2.0.0` is the first major break since `1.0`. The only incompatible change is the
type of `ListNode.items`, which went from `InlineNode[][]` to `ListItemNode[]` so
that a list item can hold full block content (nested lists, code, quotes) and a
task flag. The runtime function exports are unchanged. To migrate, read
`item.children` instead of treating an item as inline; a tight single-paragraph
item's inline content is `item.children[0].children`. See `CHANGELOG.md`.

## Semantic Versioning

From `1.0.0` onward the package follows [SemVer](https://semver.org/):

- **patch** (`1.0.x`) — bug fixes and internal changes only. No API or rendered-
  output changes that a reasonable consumer could depend on.
- **minor** (`1.x.0`) — backwards-compatible additions: new exports, new options,
  new CLI flags, new optional AST fields. May also include a deprecation
  *warning* for something slated for removal in the next major.
- **major** (`x.0.0`) — backwards-incompatible changes: removals, renames,
  changed defaults, or rendered-HTML changes that aren't bug fixes. Anything
  removed in a major was deprecated (with a warning) in a prior minor whenever
  that is technically possible.

"Rendered output" stability means: for a given input and options, a patch/minor
release produces HTML that is equivalent for consumers — security and
correctness fixes excepted, and always noted in `CHANGELOG.md`.

## What is public

These are the only supported entry points. Their runtime exports are pinned by a
test (`__tests__/package-exports.test.ts`), so an accidental addition or removal
fails CI.

| Import | Public surface |
| --- | --- |
| `orvi-lang` | `parseOrvi`, `renderOrvi`, `renderToHtml`, `formatOrvi`, `walk`, `OrviParser`, `defaultCss`, and the AST / diagnostic / options TypeScript types |
| `orvi-lang/parser` | `parseOrvi`, `OrviParser` |
| `orvi-lang/renderer` | `renderOrvi`, `renderToHtml`, `defaultCss`, `RenderOptions` |
| `orvi-lang/formatter` | `formatOrvi` |
| `orvi-lang/artifact` | `renderOrviArtifact`, `OrviArtifact`, `OrviArtifactOptions` |
| `orvi-lang/react` | `OrviRenderer` (needs a `react` peer; the main entry does **not** depend on `react`) |
| `orvi-lang/prettier-plugin` | the Prettier plugin (`--plugin orvi-lang/prettier-plugin --parser orvi`) |
| `orvi-lang/orvi-base.css` | the default stylesheet |
| `orvi` CLI | `build`, `view`, `serve`, `check`, `format`, `version`, `help` and their documented flags; the `ORVI_*` diagnostic codes |

Not public (may change in any release): the `dist/` file layout beyond the
exports map, internal helpers, `src/styles.ts` (generated), the
`__tests__`/`fixtures`/`benchmarks` trees, the playground, the VS Code extension
internals, and anything reachable only by deep-importing past the exports map.

## Deprecation policy

1. A deprecated export/option/flag keeps working and emits a one-time warning
   (`console.warn`, or a `severity: "warning"` diagnostic where that fits) that
   names the replacement.
2. It is documented as deprecated in `CHANGELOG.md` for the minor that
   introduces the warning.
3. It is removed no earlier than the next major release.

## Language spec version

The Orvi *language* is versioned separately from the package. A document's
`orvi:` metadata names the spec it targets — currently `0.1` (see
`orvi-spec-v0.1.md`). The renderer accepts `orvi: 0.1`; an unknown spec version
produces a diagnostic but still renders on a best-effort basis. A future spec
revision (`0.2`, `1.0`, …) will be additive where possible and called out in
both `orvi-spec-v0.1.md`'s successor and `CHANGELOG.md`.

## Extension model

Orvi `1.0` has **no plugin or extension API** — this is deliberate. The
extension points are the published functions:

- Need custom output? `parseOrvi(source)` gives you the AST; `walk(ast, visit)`
  does a depth-first traversal.
- Need to tweak the HTML? `renderOrvi(source, { renderNode })` overrides the
  HTML for individual block nodes (with a `defaultRender` callback for
  fall-through), or post-process the returned string.
- Need source positions in the HTML (editor integrations)?
  `renderOrvi(source, { sourceLocations: true })` adds `data-orvi-loc` to every
  block element.
- Need custom styling? Ship your own CSS instead of `orvi-base.css` (the class
  names — `orvi-*` — are part of the rendered-output contract above).

A plugin API may be added in a future major if there is real demand; until then,
keeping the surface small is what makes the SemVer guarantee above tractable.

## Supported runtimes

- **Node.js:** `>=20` (`engines.node`). CI runs the full suite on Node 20, 22,
  and 24.
- **Module systems:** both CommonJS `require()` and ESM `import`, with `.d.ts`
  for every entry point.
- **Browsers (for the rendered HTML + `orvi-base.css`):** modern evergreen
  browsers. CI renders generated HTML in headless Chrome on every run; Firefox
  and Safari smokes run when those browsers/automation are available.

## Security

Untrusted Orvi source is a supported input: `parseOrvi`, `renderOrvi`,
`renderToHtml`, `formatOrvi`, and `renderOrviArtifact` never throw on it, the
parser caps nesting depth, and the renderer escapes all text and attributes and
neutralizes non-`http(s)|mailto|tel` URLs and `<style>` content. The default
stylesheet and the generated HTML contain no scripts. Report suspected
vulnerabilities per `SECURITY.md`.

## Maintainership

`orvi-lang` is currently maintained by a single author (`jake-w-liu`). That is a
known bus-factor risk for a `1.0` project; additional maintainers are welcome —
open an issue. The release process is documented in `docs/release.md` and is
fully scripted for GitHub Releases, so it does not depend on any one person's
local setup or npm registry access.
