# Orvi — Language Design & Development Guide

> A new markup language combining the simplicity of Markdown with the visual power of HTML.

---

## Table of Contents

1. [Motivation](#motivation)
2. [Goals](#goals)
3. [Language Design](#language-design)
4. [Syntax Specification](#syntax-specification)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Tooling & Ecosystem](#tooling--ecosystem)
7. [AI Integration](#ai-integration)
8. [Settled v0.1 Decisions](#settled-v01-decisions)

---

## 1. Motivation

### The Problem with Markdown

Markdown was created in 2004 as a lightweight way to write formatted text. It succeeded brilliantly at its original goal — but the web has evolved far beyond plain text documents. Today, Markdown:

- Cannot express layout (columns, grids, cards)
- Has no native support for color, spacing, or visual components
- Has ~10 competing, incompatible specifications (CommonMark, GFM, MDX, etc.)
- Forces authors to fall back to raw HTML for anything beyond basic formatting
- Offers no semantic component model

### The Problem with HTML

HTML is powerful but hostile to human authoring:

- Extremely verbose (`<div class="card p-4 bg-blue-100">...</div>`)
- High token cost — inefficient for both humans and AI models
- Syntax errors are silent or break layout in unpredictable ways
- Not human-readable in raw form
- Tightly coupled to CSS for any visual expression

### The Gap

Few mainstream authoring languages are simultaneously:

- **Fast to write** (like Markdown)
- **Token-efficient** (good for AI generation)
- **Visually expressive** (like HTML + CSS)
- **Unambiguous** (one strict spec, one way to do each thing)
- **Semantically rich** (components, not just tags)

**Orvi is designed to fill that gap.**

### Why the Name Orvi?

Orvi is a coined short name from "ordered visual." The story is simple: authors
write ordered, readable source text, and the renderer turns it into visual
structure. The name also keeps the toolchain compact: `orvi` for the CLI,
`orvi-lang` for the npm package, and `.ov` for files.

This naming story does not claim trademark ownership, domain ownership, or that
the word is unused elsewhere; those remain separate release and branding checks.

### Why Now?

The emergence of AI writing assistants changes the calculus. Previous markup languages failed partly due to lack of adoption — authors had to learn them. With AI:

- The language can be generated, not just hand-written
- A model can be trained on the spec and produce Orvi natively
- The renderer can be bootstrapped by AI and iterated quickly
- Orvi can serve as a **native output format for AI-generated rich content**

---

## 2. Goals

### Primary Goals

| Goal                 | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| **Human writable**   | A developer or writer can learn Orvi in under an hour        |
| **AI writable**      | Minimal tokens, reduced ambiguity, narrow v0.1 edge cases   |
| **Visually rich**    | Supports layout, color, components, and interactivity hints |
| **One spec**         | No fragmentation; one canonical parser                      |
| **No HTML fallback** | Supported document constructs are expressed natively in Orvi |

### Non-Goals

- Orvi is **not** a programming language
- Orvi is **not** a replacement for full React/Vue apps
- Orvi is **not** trying to replace HTML in browsers natively
- Orvi is **not** designed for data (use JSON/YAML for that)

### Design Principles

1. **Minimal punctuation** — every character earns its place
2. **Readable raw** — a `.ov` file should be understandable without rendering
3. **Fail visibly** — syntax errors should be obvious, not silent
4. **Progressive complexity** — simple things are simple; complex things are possible
5. **Compile to HTML** — Orvi is always rendered via a HTML/CSS layer

---

## 3. Language Design

### Conceptual Model

Orvi is structured around three layers:

```
Layer 1: Text Content      (like Markdown — headings, paragraphs, lists)
Layer 2: Visual Scope      (color, emphasis, inline styling)
Layer 3: Layout Components (grids, cards, callouts, buttons)
```

Each layer builds on the previous. A document can use only Layer 1 and look like clean Markdown output. Adding Layer 2 brings color and visual hierarchy. Layer 3 adds full layout control.

### Core Philosophy

> "If you can write it in Markdown, Orvi should feel identical. When you need more, Orvi gives you a clean path forward — never a wall."

---

## 4. Syntax Specification

### 4.1 Text & Headings

Markdown-like for maximum familiarity:

```orvi
# Heading 1
## Heading 2
### Heading 3

Regular paragraph text.

**bold**, _italic_, ~~strikethrough~~
```

### 4.1.1 Top-Level Metadata

A document may begin with an optional metadata block. It is not rendered.

```text
---
orvi: 0.1
title: Document Title
lang: en
dir: ltr
---

# Document Title
```

Supported metadata keys in v0.1:

- `orvi`: optional spec version marker; use `0.1`
- `title`: optional full-document HTML title
- `lang`: optional document language metadata
- `dir`: optional text direction; one of `ltr`, `rtl`, or `auto`

### 4.2 Inline Visual Scope

Use `[modifier]` syntax to open a visual scope and `[]` to close it:

```orvi
[red] This text is red []
[blue bold] This is blue and bold []
[bg=yellow] Highlighted text []
[sm] Small text []
[lg] Large text []
```

Modifiers can be:

- Named colors: `red`, `blue`, `green`, `gray`, `muted`, `yellow`, `purple`, `orange`, `pink`, `cyan`, `white`, `black`
- Text size: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`
- Weight: `light`, `regular`, `medium`, `bold`
- Background: `bg=<color>` (uses the same color names)
- Combined: `[red bold lg]`

### 4.3 Block Components

Block components use a `[component options]` open tag and `[/component]` close tag:

**Callout / Alert Box:**

```orvi
[callout]
  This is an important note.
[/callout]

[callout type=warning]
  Proceed with caution.
[/callout]

[callout type=success]
  Everything worked!
[/callout]
```

**Grid Layout:**

```orvi
[grid 3]
  First column content here.
  ---
  Second column content here.
  ---
  Third column content here.
[/grid]
```

**Card:**

```orvi
[card]
  ## Card Title
  Card body content goes here.
[/card]

[card bg=blue]
  ## Styled Card
  With a colored background.
[/card]
```

**Tabs:**

```orvi
[tabs]
  [tab label=Overview]
    Overview content here.
  [/tab]
  [tab label=Details]
    Details content here.
  [/tab]
[/tabs]
```

Tabs are declarative. The v0.1 renderer provides tab behavior with generated
HTML and CSS; Orvi documents do not contain user script.

### 4.4 Semantic Elements

Single-line semantic components use a `keyword:` prefix syntax:

```orvi
btn: Click Me → https://example.com
img: ./photo.jpg | A beautiful sunset
hr:
br:
badge: New Feature
badge: Beta | type=warning
```

### 4.5 Code Blocks

Same as Markdown with optional filename annotation:

````orvi
    ```python | app.py
    def hello():
        print("Hello, Orvi!")
    ```
````

### 4.6 Tables

GFM-style tables:

```orvi
| Name  | Role    | Status  |
|-------|---------|---------|
| Alice | Dev     | Active  |
| Bob   | Design  | Active  |
```

### 4.7 Comments

```orvi
// This is a comment — not rendered
```

### 4.8 Unsupported Dynamic Content

Orvi v0.1 is static markup. Dynamic content and expressions such as `{name}` are
unsupported outside fenced code blocks and produce parser diagnostics.

### 4.9 Full Example Document

```orvi
---
orvi: 0.1
lang: en
dir: ltr
---

# Welcome to Orvi

[blue bold] A new way to write beautiful documents. []

---

[grid 2]
  ## Why Orvi?
  Simple syntax that compiles to rich HTML.
  No more falling back to raw tags.
  ---
  ## Who is it for?
  Writers, developers, and AI systems that need
  expressive output without verbose markup.
[/grid]

---

[callout type=info]
  Orvi is currently in early development.
  Contributions welcome.
[/callout]

btn: Get Started → https://github.com/jake-w-liu/orvi
```

---

## 5. Implementation Roadmap

Progress is tracked in this guide. Keep the checkboxes below aligned with what
is implemented in the current repo, and split partly complete items instead of
marking the parent complete.

### Phase 0 — Specification

- [x] Write the formal grammar (EBNF) in `orvi-spec-v0.1.md`
- [x] Define built-in modifiers and component types
- [x] Document parser error rules and basic syntax conflicts
- [x] Create a Jest test suite covering valid and invalid Orvi documents
- [x] Publish the spec as a versioned document (`orvi-spec-v0.1.md`)

### Phase 1 — Parser

**Stack recommendation:** TypeScript (for portability — runs in browser and Node.js)

- [x] Implement a parser/tokenization pass that identifies headings, blocks, inline scopes, and semantic elements
- [x] Implement an AST builder
  - Nodes include `Document`, `Heading`, `Paragraph`, `Component`, `InlineScope`, `SemanticElement`, lists, tables, and code blocks
- [x] Write parser unit tests against the Phase 0 language surface
- [x] Handle parser errors with diagnostics instead of throwing on bad input
- [x] Include diagnostic source ranges for editor integrations
- [x] Validate core edge cases: unknown components/options, grid column counts, ragged tables, and tabs structure
- [x] Enforce v0.1 language decisions: maximum component nesting depth, unsupported dynamic expressions, metadata keys, and `img` alt text

**Output:** `orvi-lang/parser` export

### Phase 2 — HTML Renderer

- [x] Walk the AST and emit semantic HTML + scoped CSS classes
- [x] Create a default stylesheet (`orvi-base.css`)
  - Defines color tokens, grid system, card styles, callout variants, badges, tabs, tables, code, and inline modifiers
- [x] Support a theming API (`orvi.config.js`)
- [x] Support renderer/theme color scheme selection with `colorScheme: "dark"`
- [x] Render declarative CSS tabs with ARIA attributes
- [x] Render callouts, images, tabs, and document structure with accessibility-oriented markup
- [x] Add generated HTML launch smoke coverage for Firefox headless, with a clean skip when Firefox is unavailable
- [x] Add generated HTML DOM smoke coverage for Chrome headless, with a clean skip when Chrome is unavailable
- [x] Add Safari WebDriver render smoke harness with clean skip when remote automation is disabled
- [x] Add Safari WebDriver DOM render smoke coverage; it runs when Safari remote automation is enabled on the host machine

**Output:** `orvi-lang/renderer` export

### Phase 3 — Developer Tooling

- [x] **CLI tool:** `orvi build input.ov` → `output.html`
- [x] **CLI check/format:** `orvi check` and `orvi format`
- [x] **Machine-readable diagnostics:** `orvi check --json` and `orvi format --check --json`
- [x] **Live preview server:** `orvi serve` with hot reload
- [x] **VS Code extension:**
  - [x] Syntax highlighting scaffold
  - [x] Snippets scaffold
  - [x] Language configuration scaffold
  - [x] Diagnostics via the bundled Orvi CLI
  - [x] Packaging script for `.vsix`
  - [x] Autocomplete for components and modifiers
  - [x] Live preview panel
  - [x] Right-click / Explorer context-menu preview and `Cmd/Ctrl+Shift+V` keybindings
  - [x] Release prep metadata, bundled runtime, README, changelog, license, package lock, and `.vscodeignore`
- [x] Prepare VS Code extension v0.1.1 with bundled CLI/runtime so diagnostics and preview do not require a global `orvi` command
- [x] Add token-free VSIX package workflow for GitHub Release distribution (no Azure DevOps token)
- [x] Add Open VSX publish workflow gated by `OVSX_PAT`
- [x] Drop the Azure-tied VS Code Marketplace publish workflow; distribute via GitHub Release VSIX and Open VSX instead
- [x] Wire npm publish: `package.json` metadata/`bin`/`repository`, `.github/workflows/publish-npm.yml` gated by `NPM_TOKEN`, runbook in `docs/release.md`
- [ ] Publish the `orvi-lang` package to npm (needs an npm account + `NPM_TOKEN`; not a code task)
- [x] **Prettier plugin bridge** for auto-formatting `.ov` files
- [x] Add basic Prettier CLI fixture coverage to `npm run verify`
- [x] Add GitHub Actions CI for `npm run verify`

### Phase 4 — Ecosystem

- [x] **React component:** `<OrviRenderer source={orviString} />`
- [x] **ESM package output:** importable browser-friendly module build
- [x] Add React fixture app/browser smoke coverage
- [x] **Obsidian plugin scaffold** — render Orvi code blocks and `.ov` previews in Obsidian
- [x] **AI artifact/render-surface support** — native Orvi artifact JSON output type
- [x] **GitHub Pages rendering** — render `.ov` files from the repo as HTML previews
- [x] **Native GitHub rendering decision** — direct GitHub.com `.ov` rendering requires GitHub platform support; Orvi uses generated GitHub Pages previews instead (see `docs/release.md`)
- [x] **github-linguist submission kit** — full copy-pasteable kit in `docs/linguist-submission.md` (grammar, `languages.yml`/`grammars.yml` entries, submodule + `language_id` steps, sample requirement); interim `.gitattributes` override highlights `.ov` as Markdown on GitHub.com today
- [ ] **github-linguist PR** — open the Linguist PR once `.ov` meets the cross-repo usage bar (parked until then; not a code task)
- [x] Static **Orvi Playground** with editor + preview split
- [x] Add GitHub Pages deployment workflow for the Orvi Playground
- [x] Enable GitHub Pages for the repository with GitHub Actions workflow builds
- [x] Serve an Orvi-authored quickstart (`examples/getting-started.ov`) as the GitHub Pages landing page, with a nav strip to the playground, rendered examples, GitHub, and the VS Code extension
- [x] Add varied example documents (`examples/getting-started.ov`, `examples/dashboard.ov`) alongside `welcome.ov`
- [x] Gate `orvi.dev` custom-domain deployment behind `ORVI_PAGES_CNAME` so the default Pages URL stays usable

Optional external branding step: `orvi.dev` is not registered as of the latest
RDAP check on 2026-05-11. The repo keeps custom-domain support gated behind
`ORVI_PAGES_CNAME`, but domain purchase, DNS ownership, and certificate issuance
are outside implementation progress.

### Phase 5 — AI Training & Optimization (Ongoing)

- [x] Add a small deterministic benchmark corpus of valid Orvi documents
- [x] Generate a larger deterministic corpus of valid Orvi documents
- [x] Prompt-engineer model-neutral guidance for AI systems to write idiomatic Orvi
- [x] Prepare a provider-neutral fine-tuning JSONL corpus with deterministic validation
- [ ] Fine-tune a model on the Orvi corpus with a selected provider and budget
- [x] Measure token-ish byte/character efficiency vs paired expected rendered HTML
- [x] Publish benchmark results in `docs/benchmarks.md`

---

## 6. Tooling & Ecosystem

### Minimum Viable Toolchain

```
.ov file → [orvi parser] → AST → [orvi renderer] → HTML + CSS → Browser
```

### Recommended Tech Stack

| Layer          | Technology       | Reason                           |
| -------------- | ---------------- | -------------------------------- |
| Parser         | TypeScript       | Portable, typed, runs everywhere |
| Renderer       | TypeScript + CSS | No runtime dependencies          |
| CLI            | Node.js          | Familiar to web developers       |
| Editor Support | VS Code API      | Largest editor share             |
| Playground     | Static browser ESM | Interactive prototype without a bundled editor dependency |
| Documentation  | Markdown + Orvi examples | Current docs plus dogfooded render fixtures |

### File Conventions

| File            | Purpose                                 |
| --------------- | --------------------------------------- |
| `*.ov`         | Orvi source document                     |
| `orvi.config.js` | Project-level theme and renderer config |
| `orvi-spec.md`   | The canonical language specification    |

---

## 7. AI Integration

Orvi is designed to be an **AI-authoring-friendly markup language.**

### Token Efficiency

The current deterministic benchmark corpus shows Orvi source is **56.5% smaller by characters and bytes** than its paired rendered HTML. Token savings still need tokenizer-specific measurement. This matters for:

- Reduced API costs when generating rich content
- Faster generation
- More content fitting within context windows

### Prompt Engineering

A system prompt can instruct a model to output Orvi natively:

```
You are an Orvi document generator. Always respond using valid Orvi syntax.
Use [grid], [card], [callout], and inline scopes to produce visually rich output.
Never use raw HTML. Refer to the Orvi spec for syntax rules.
```

### AI-Native Output

A long-term goal is for AI-enabled authoring and artifact surfaces to support `.ov` as a first-class render target — allowing models and agents to produce rich, interactive-feeling documents without writing a single line of HTML or JSX.

---

## 8. Settled v0.1 Decisions

The original open questions below now have v0.1 answers:

1. **Nesting depth** — Component nesting defaults to a maximum depth of `8`.
2. **Dynamic content** — Variables and expressions such as `{name}` are not supported in v0.1. They produce diagnostics outside fenced code blocks.
3. **Interactivity** — Interactivity remains declarative. Orvi has no user-script syntax; tabs are rendered with generated HTML and CSS.
4. **Dark mode** — Dark mode is a renderer/theme color scheme selected with `colorScheme: "dark"`, not arbitrary Orvi syntax.
5. **Accessibility** — v0.1 enforces a focused accessibility baseline: images require alt text, callouts receive roles and labels, tabs receive ARIA wiring, and output uses semantic HTML.
6. **Internationalization** — Documents support top-level `lang` and `dir` metadata from day one. `dir` may be `ltr`, `rtl`, or `auto`.
7. **Versioning** — Documents may declare an optional top-level metadata block with `orvi: 0.1`; `title` metadata feeds full-document HTML titles.
8. **Governance** — Governance remains project-owner led for now; a public issue can revisit this when the project needs a broader process.

---

## Contributing

Orvi is an open idea. The best next steps are:

1. Critique this spec — find the edge cases and weaknesses
2. Improve the prototype parser and renderer by finding edge cases
3. Write documents in Orvi (even manually) to test readability
4. Propose missing components or syntax improvements

---

_Orvi v0.1 Concept — May 2026_
_Status: v0.1 prototype in progress; this guide is the progress ledger_
