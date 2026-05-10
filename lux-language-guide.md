# Lux — Language Design & Development Guide

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

There is no language today that is simultaneously:

- **Fast to write** (like Markdown)
- **Token-efficient** (good for AI generation)
- **Visually expressive** (like HTML + CSS)
- **Unambiguous** (one strict spec, one way to do each thing)
- **Semantically rich** (components, not just tags)

**Lux is designed to fill that gap.**

### Why Now?

The emergence of AI writing assistants changes the calculus. Previous markup languages failed partly due to lack of adoption — authors had to learn them. With AI:

- The language can be generated, not just hand-written
- A model can be trained on the spec and produce Lux natively
- The renderer can be bootstrapped by AI and iterated quickly
- Lux can serve as a **native output format for AI-generated rich content**

---

## 2. Goals

### Primary Goals

| Goal | Description |
|------|-------------|
| **Human writable** | A developer or writer can learn Lux in under an hour |
| **AI writable** | Minimal tokens, unambiguous syntax, no edge cases |
| **Visually rich** | Supports layout, color, components, and interactivity hints |
| **One spec** | No fragmentation; one canonical parser |
| **No HTML fallback** | Everything expressible natively in Lux |

### Non-Goals

- Lux is **not** a programming language
- Lux is **not** a replacement for full React/Vue apps
- Lux is **not** trying to replace HTML in browsers natively
- Lux is **not** designed for data (use JSON/YAML for that)

### Design Principles

1. **Minimal punctuation** — every character earns its place
2. **Readable raw** — a `.lux` file should be understandable without rendering
3. **Fail visibly** — syntax errors should be obvious, not silent
4. **Progressive complexity** — simple things are simple; complex things are possible
5. **Compile to HTML** — Lux is always rendered via a HTML/CSS layer

---

## 3. Language Design

### Conceptual Model

Lux is structured around three layers:

```
Layer 1: Text Content      (like Markdown — headings, paragraphs, lists)
Layer 2: Visual Scope      (color, emphasis, inline styling)
Layer 3: Layout Components (grids, cards, callouts, buttons)
```

Each layer builds on the previous. A document can use only Layer 1 and look like clean Markdown output. Adding Layer 2 brings color and visual hierarchy. Layer 3 adds full layout control.

### Core Philosophy

> "If you can write it in Markdown, Lux should feel identical. When you need more, Lux gives you a clean path forward — never a wall."

---

## 4. Syntax Specification

### 4.1 Text & Headings

Identical to Markdown for maximum familiarity:

```lux
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
lux: 0.1
title: Document Title
lang: en
dir: ltr
---

# Document Title
```

Supported metadata keys in v0.1:

- `lux`: optional spec version marker; use `0.1`
- `title`: optional full-document HTML title
- `lang`: optional document language metadata
- `dir`: optional text direction; one of `ltr`, `rtl`, or `auto`

### 4.2 Inline Visual Scope

Use `[modifier]` syntax to open a visual scope and `[]` to close it:

```lux
[red] This text is red []
[blue bold] This is blue and bold []
[bg=yellow] Highlighted text []
[sm] Small text []
[lg] Large text []
```

Modifiers can be:
- Named colors: `red`, `blue`, `green`, `gray`, `muted`, etc.
- Text size: `sm`, `md`, `lg`, `xl`
- Weight: `bold`, `light`
- Background: `bg=colorname`
- Combined: `[red bold lg]`

### 4.3 Block Components

Block components use a `[component options]` open tag and `[/component]` close tag:

**Callout / Alert Box:**
```lux
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
```lux
[grid 3]
  First column content here.
  ---
  Second column content here.
  ---
  Third column content here.
[/grid]
```

**Card:**
```lux
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
```lux
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
HTML and CSS; Lux documents do not contain user script.

### 4.4 Semantic Elements

Single-line semantic components use a `keyword:` prefix syntax:

```lux
btn: Click Me → https://example.com
img: ./photo.jpg | A beautiful sunset
hr:
br:
badge: New Feature
badge: Beta | type=warning
```

### 4.5 Code Blocks

Same as Markdown with optional filename annotation:

```lux
    ```python | app.py
    def hello():
        print("Hello, Lux!")
    ```
```

### 4.6 Tables

Same as Markdown GFM tables:

```lux
| Name  | Role    | Status  |
|-------|---------|---------|
| Alice | Dev     | Active  |
| Bob   | Design  | Active  |
```

### 4.7 Comments

```lux
// This is a comment — not rendered
```

### 4.8 Unsupported Dynamic Content

Lux v0.1 is static markup. Dynamic content and expressions such as `{name}` are
unsupported outside fenced code blocks and produce parser diagnostics.

### 4.9 Full Example Document

```lux
---
lux: 0.1
lang: en
dir: ltr
---

# Welcome to Lux

[blue bold] A new way to write beautiful documents. []

---

[grid 2]
  ## Why Lux?
  Simple syntax that compiles to rich HTML.
  No more falling back to raw tags.
  ---
  ## Who is it for?
  Writers, developers, and AI systems that need
  expressive output without verbose markup.
[/grid]

---

[callout type=info]
  Lux is currently in early development.
  Contributions welcome.
[/callout]

btn: Get Started → https://lux-lang.dev
```

---

## 5. Implementation Roadmap

Progress is tracked in this guide. Keep the checkboxes below aligned with what
is implemented in the current repo, and split partly complete items instead of
marking the parent complete.

### Phase 0 — Specification

- [x] Write the formal grammar (EBNF) in `lux-spec-v0.1.md`
- [x] Define built-in modifiers and component types
- [x] Document parser error rules and basic syntax conflicts
- [x] Create a Jest test suite covering valid and invalid Lux documents
- [x] Publish the spec as a versioned document (`lux-spec-v0.1.md`)

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

**Output:** `@lux-lang/lux/parser` export

### Phase 2 — HTML Renderer

- [x] Walk the AST and emit semantic HTML + scoped CSS classes
- [x] Create a default stylesheet (`lux-base.css`)
  - Defines color tokens, grid system, card styles, callout variants, badges, tabs, tables, code, and inline modifiers
- [x] Support a theming API (`lux.config.js`)
- [x] Support renderer/theme color scheme selection with `colorScheme: "dark"`
- [x] Render declarative CSS tabs with ARIA attributes
- [x] Render callouts, images, tabs, and document structure with v0.1 accessibility guarantees
- [x] Test generated HTML launch in Firefox headless
- [x] Test generated HTML DOM in Chrome headless
- [x] Add Safari WebDriver render smoke harness with clean skip when remote automation is disabled
- [x] Run Safari WebDriver DOM render smoke with Safari remote automation enabled on the host machine

**Output:** `@lux-lang/lux/renderer` export

### Phase 3 — Developer Tooling

- [x] **CLI tool:** `lux build input.lux` → `output.html`
- [x] **CLI check/format:** `lux check` and `lux format`
- [x] **Machine-readable diagnostics:** `lux check --json` and `lux format --check --json`
- [x] **Live preview server:** `lux serve` with hot reload
- [x] **VS Code extension:**
  - [x] Syntax highlighting scaffold
  - [x] Snippets scaffold
  - [x] Language configuration scaffold
  - [x] Diagnostics via `lux check --json`
  - [x] Packaging script for `.vsix`
  - [x] Autocomplete for components and modifiers
  - [x] Live preview panel
  - [x] Release prep metadata, README, changelog, license, package lock, and `.vscodeignore`
- [x] Add token-backed workflow for publishing the VS Code extension to the Marketplace
- [x] Publish VS Code extension v0.1.0 to the Marketplace as `jake-w-liu.lux-language`
- [x] Harden Marketplace release workflow with token validation and VSIX artifact capture
- [ ] Configure `VSCE_PAT` for repeatable automated Marketplace releases
- [x] **Prettier plugin bridge** for auto-formatting `.lux` files
- [x] Add basic Prettier CLI fixture coverage to `npm run verify`
- [x] Add GitHub Actions CI for `npm run verify`

### Phase 4 — Ecosystem

- [x] **React component:** `<LuxRenderer source={luxString} />`
- [x] **ESM package output:** importable browser-friendly module build
- [x] Add React fixture app/browser smoke coverage
- [x] **Obsidian plugin scaffold** — render Lux code blocks and `.lux` previews in Obsidian
- [x] **AI artifact/render-surface support** — native Lux artifact JSON output type
- [x] **GitHub Pages rendering** — render `.lux` files from the repo as HTML previews
- [ ] **Native GitHub rendering** — `.lux` files rendered directly in repos (requires GitHub platform support)
- [x] Static **Lux Playground** with editor + preview split
- [x] Add GitHub Pages deployment workflow for the Lux Playground
- [x] Enable GitHub Pages for the repository with GitHub Actions workflow builds
- [ ] Point `lux-lang.dev` DNS at the deployed GitHub Pages site and configure it as the Pages custom domain

### Phase 5 — AI Training & Optimization (Ongoing)

- [x] Add a small deterministic benchmark corpus of valid Lux documents
- [x] Generate a larger deterministic corpus of valid Lux documents
- [x] Prompt-engineer model-neutral guidance for AI systems to write idiomatic Lux
- [x] Prepare a provider-neutral fine-tuning JSONL corpus with deterministic validation
- [ ] Fine-tune a model on the Lux corpus with a selected provider and budget
- [x] Measure token-ish byte/character efficiency vs rendered HTML for equivalent visual output
- [x] Publish benchmark results in `docs/benchmarks.md`

---

## 6. Tooling & Ecosystem

### Minimum Viable Toolchain

```
.lux file → [lux parser] → AST → [lux renderer] → HTML + CSS → Browser
```

### Recommended Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Parser | TypeScript | Portable, typed, runs everywhere |
| Renderer | TypeScript + CSS | No runtime dependencies |
| CLI | Node.js | Familiar to web developers |
| Editor Support | VS Code API | Largest editor share |
| Playground | React + Monaco | Interactive, embeddable |
| Documentation | Lux itself | Dogfooding the language |

### File Conventions

| File | Purpose |
|------|---------|
| `*.lux` | Lux source document |
| `lux.config.js` | Project-level theme and renderer config |
| `lux-spec.md` | The canonical language specification |

---

## 7. AI Integration

Lux has a unique opportunity to be the **first markup language designed with AI authorship in mind.**

### Token Efficiency

Preliminary estimates suggest Lux can express the same visual content as HTML in **40–60% fewer tokens.** This matters for:

- Reduced API costs when generating rich content
- Faster generation
- More content fitting within context windows

### Prompt Engineering

A system prompt can instruct a model to output Lux natively:

```
You are a Lux document generator. Always respond using valid Lux syntax.
Use [grid], [card], [callout], and inline scopes to produce visually rich output.
Never use raw HTML. Refer to the Lux spec for syntax rules.
```

### AI-Native Output

A long-term goal is for AI-enabled authoring and artifact surfaces to support `.lux` as a first-class render target — allowing models and agents to produce rich, interactive-feeling documents without writing a single line of HTML or JSX.

---

## 8. Settled v0.1 Decisions

The original open questions below now have v0.1 answers:

1. **Nesting depth** — Component nesting defaults to a maximum depth of `8`.
2. **Dynamic content** — Variables and expressions such as `{name}` are not supported in v0.1. They produce diagnostics outside fenced code blocks.
3. **Interactivity** — Interactivity remains declarative. Lux has no user-script syntax; tabs are rendered with generated HTML and CSS.
4. **Dark mode** — Dark mode is a renderer/theme color scheme selected with `colorScheme: "dark"`, not arbitrary Lux syntax.
5. **Accessibility** — Accessibility is enforced by the parser and renderer: images require alt text, callouts receive roles and labels, tabs receive ARIA wiring, and output uses semantic HTML.
6. **Internationalization** — Documents support top-level `lang` and `dir` metadata from day one. `dir` may be `ltr`, `rtl`, or `auto`.
7. **Versioning** — Documents may declare an optional top-level metadata block with `lux: 0.1`; `title` metadata feeds full-document HTML titles.
8. **Governance** — Governance remains project-owner led for now; a public issue can revisit this when the project needs a broader process.

---

## Contributing

Lux is an open idea. The best next steps are:

1. Critique this spec — find the edge cases and weaknesses
2. Build a prototype parser — even a rough one proves the concept
3. Write documents in Lux (even manually) to test readability
4. Propose missing components or syntax improvements

---

*Lux v0.1 Concept — May 2026*
*Status: v0.1 prototype in progress; this guide is the progress ledger*
