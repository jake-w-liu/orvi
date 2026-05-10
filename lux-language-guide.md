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
8. [Open Questions](#open-questions)

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

### 4.8 Full Example Document

```lux
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

### Phase 0 — Specification (Weeks 1–2)

- [ ] Write the full formal grammar (EBNF or PEG)
- [ ] Define all built-in modifiers and component types
- [ ] Document edge cases and conflict resolution rules
- [ ] Create a test suite of valid/invalid Lux documents
- [ ] Publish the spec as a versioned document (`lux-spec-v0.1.md`)

### Phase 1 — Parser (Weeks 3–6)

**Stack recommendation:** TypeScript (for portability — runs in browser and Node.js)

- [ ] Implement a tokenizer (lexer)
  - Identify headings, blocks, inline scopes, semantic elements
- [ ] Implement an AST (Abstract Syntax Tree) builder
  - Nodes: `Document`, `Heading`, `Paragraph`, `Block`, `InlineScope`, `SemanticElement`
- [ ] Write parser unit tests against the Phase 0 test suite
- [ ] Handle error recovery gracefully (never crash on bad input)

**Output:** A `@lux-lang/parser` npm package

### Phase 2 — HTML Renderer (Weeks 7–9)

- [ ] Walk the AST and emit semantic HTML + scoped CSS classes
- [ ] Create a default stylesheet (`lux-base.css`)
  - Define color tokens, grid system, card styles, callout variants
- [ ] Support a theming API (`lux.config.js`)
- [ ] Test rendering in Chrome, Firefox, Safari

**Output:** A `@lux-lang/renderer` npm package

### Phase 3 — Developer Tooling (Weeks 10–14)

- [ ] **CLI tool:** `lux build input.lux` → `output.html`
- [ ] **Live preview server:** `lux serve` with hot reload
- [ ] **VS Code extension:**
  - Syntax highlighting
  - Autocomplete for components and modifiers
  - Live preview panel
- [ ] **Prettier plugin** for auto-formatting `.lux` files

### Phase 4 — Ecosystem (Weeks 15–20)

- [ ] **React component:** `<LuxRenderer source={luxString} />`
- [ ] **Obsidian plugin** — render `.lux` notes natively
- [ ] **Claude artifact support** — native Lux output type
- [ ] **GitHub rendering** — `.lux` files rendered in repos (like `.md`)
- [ ] Online **Lux Playground** at `lux-lang.dev`

### Phase 5 — AI Training & Optimization (Ongoing)

- [ ] Generate a large corpus of valid Lux documents
- [ ] Fine-tune or prompt-engineer Claude/GPT to write idiomatic Lux
- [ ] Measure token efficiency vs HTML for equivalent visual output
- [ ] Publish benchmark results

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

### Claude-Native Output

A long-term goal is for Claude artifacts to support `.lux` as a first-class render target — allowing Claude to produce rich, interactive-feeling documents without writing a single line of HTML or JSX.

---

## 8. Open Questions

These are design decisions that require community input or further research:

1. **Nesting depth** — How deeply can components nest? Should there be a limit?
2. **Dynamic content** — Should Lux support variables or expressions? (e.g., `{name}`)
3. **Interactivity** — Should buttons/tabs have behavior hints, or remain purely presentational?
4. **Dark mode** — Should the spec define dark mode semantics, or leave it to themes?
5. **Accessibility** — How do we enforce alt text, ARIA roles, semantic structure?
6. **Internationalization** — RTL language support from day one?
7. **Versioning** — How do breaking spec changes get handled?
8. **Governance** — Who owns the spec? Open foundation, single org, or BDFL model?

---

## Contributing

Lux is an open idea. The best next steps are:

1. Critique this spec — find the edge cases and weaknesses
2. Build a prototype parser — even a rough one proves the concept
3. Write documents in Lux (even manually) to test readability
4. Propose missing components or syntax improvements

---

*Lux v0.1 Concept — May 2026*
*Status: Pre-specification / Community Draft*
