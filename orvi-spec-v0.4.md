# Orvi Specification v0.4

This is the fourth executable Orvi specification, a backwards-compatible superset
of [`v0.3`](orvi-spec-v0.3.md) (and `v0.2`, `v0.1`). `v0.4` enriches lists:
**nested lists**, **block content in list items** (paragraphs, sub-lists, code,
components, quotes), **loose vs tight** lists, an **ordered `start`**, and **task
lists** (`- [ ]` / `- [x]`). A document that uses only flat single-line list
items renders identically to `v0.3`.

A document may mark its version with `orvi: 0.1`, `orvi: 0.2`, `orvi: 0.3`, or
`orvi: 0.4`; all validate against this parser.

## Document Model

A Orvi document is an optional top-level metadata block followed by a sequence
of block nodes. Blank lines separate paragraphs. Line comments begin with `//`
after optional indentation and are not rendered.

Metadata is not rendered as content. v0.4 supports `orvi: 0.1|0.2|0.3|0.4`,
`title: <text>`, `lang: <language-tag>`, and `dir: ltr|rtl|auto`.

## Grammar

```ebnf
document        = [ metadata_block ] { blank | comment | block } ;
metadata_block  = "---" newline { blank | comment | metadata_entry } "---" newline ;
metadata_entry  = metadata_key ":" whitespace metadata_value newline ;
metadata_key    = "orvi" | "title" | "lang" | "dir" ;
metadata_value  = "0.1" | "0.2" | "0.3" | "0.4" | title_text | language_tag | "ltr" | "rtl" | "auto" ;
title_text      = bare_token { whitespace bare_token } ;
language_tag    = bare_token ;
block           = heading | thematic_break | code_block | table | list
                | component | semantic | blockquote | paragraph ;

heading         = 1*6("#") whitespace inline_text newline ;
thematic_break  = "---" newline ;
comment         = whitespace "//" { any } newline ;

blockquote      = 1*( whitespace ">" [ " " ] { any } newline ) ;  ; added in orvi-lang 1.4 / spec 0.3

code_block      = fence_open { code_line } fence_close ;
fence_open      = "```" [ language ] [ "|" filename ] newline ;
fence_close     = "```" newline ;

table           = table_row table_divider table_row { table_row } ;
table_row       = [ "|" ] cell { "|" cell } [ "|" ] newline ;
table_divider   = "|" divider { "|" divider } [ "|" ] newline ;   ; the divider must carry a pipe
divider         = ":"? 3*("-") ":"? ;                              ; leading/trailing ":" sets column alignment

list            = list_item { list_item } ;                ; siblings share a marker indent
list_item       = marker [ task_box ] [ item_content ] ;   ; content + indented child blocks
marker          = ("-" | "*") | ( digit+ "." ) ;
task_box        = "[" ( " " | "x" | "X" ) "]" whitespace ; ; added in spec 0.4

component       = component_open { block } component_close ;
component_open  = "[" component_name { whitespace component_token } "]" newline ;
component_close = "[/" component_name "]" newline ;
component_token = bare_token | key "=" bare_token ;

grid            = "[grid" whitespace column_count "]" newline
                  grid_column { "---" newline grid_column }
                  "[/grid]" newline ;
grid_column     = { block } ;

semantic        = semantic_name ":" [ semantic_payload ] newline ;

paragraph       = inline_text { newline inline_text } ;

inline_text     = { text | escape | strong | emphasis | strike | inline_code
                  | inline_scope | link | autolink | hard_break } ;
escape          = "\" ascii_punctuation ;                          ; renders the literal character
strong          = "**" inline_text "**" ;
emphasis        = ( "_" inline_text "_" ) | ( "*" inline_text "*" ) ; ; flanking: open before non-space, close after non-space
strike          = "~~" inline_text "~~" ;
inline_code     = "`" { any_but_backtick } "`" ;                   ; content is verbatim, not re-parsed
inline_scope    = "[" modifier { whitespace modifier } "]" inline_text "[]" ;
link            = "[" inline_text "]" "(" href ")" ;               ; added in orvi-lang 1.1
autolink        = ( "http" | "https" ) "://" url_char { url_char } ; ; added in orvi-lang 1.3
hard_break      = "\" newline ;                                    ; a trailing backslash, added in orvi-lang 1.3
modifier        = color | size | weight | "bg=" color ;
```

### Escaping

A backslash before any ASCII punctuation character yields that literal
character (so `\*`, `` \` ``, `\[`, `\\` are the literal `*`, `` ` ``, `[`, `\`).
A backslash before any other character (or at end of input without a following
newline) is a literal backslash.

### Inline code

A backtick opens an inline code span and the next backtick closes it. The
content between is rendered verbatim and HTML-escaped — no Orvi markup inside a
code span is interpreted. An unpaired backtick is a literal character. (Inline
code spans cannot themselves contain a backtick.)

### Emphasis

`_text_` and `*text*` both produce emphasis. A delimiter opens only when it is
not preceded by a word character and is immediately followed by a non-space
character; it closes only when immediately preceded by a non-space character and
not followed by a word character. Thus `2 * 3 * 4` and `a _ b _ c` are literal.

### Links and autolinks

A `link` is recognized only when the bracket content is **not** a valid
`modifier` list (so it can never shadow an `inline_scope`): `[red](x)` is the
scope opener `[red]` followed by the text `(x)`, while `[the docs](url)` is a
link. The `href` is everything up to the first `)`; a URL containing `)` must be
percent-encoded.

An `autolink` is a bare `http://` or `https://` URL written directly in the
text. It must begin at a non-alphanumeric boundary. Trailing sentence
punctuation (`.,;:!?'")]`) is excluded from the URL; a trailing `)` is kept only
when it balances a `(` inside the URL. Bare email addresses, `mailto:`/`tel:`,
and other schemes are **not** autolinked. The renderer applies the same URL
sanitizing as `btn:`/`img:`/`link`.

### Hard line breaks

Within a paragraph, a line ending in a single backslash produces a hard line
break (`<br>`). A plain wrapped line is a soft break, rendered as a space.

### Table column alignment

A divider cell may carry a leading and/or trailing colon to set the column's
text alignment: `:---` left, `:--:` center, `---:` right, `---` unset. The
divider line must contain at least one pipe (so a single-cell `| Note |` over a
bare `---` is a paragraph plus a thematic break, not a one-column table).

### Lists

A list is a run of items sharing one marker indentation. An unordered marker is
`-` or `*` (both render the same; the formatter canonicalizes `*` to `-`); an
ordered marker is `digit+ .`, and the first number is the list's `start`.

**Nesting and block content.** An item's content begins at its content column —
the column of the marker text plus the marker, one space, and (for a task item)
the `[ ]` box. Lines indented to at least the content column are the item's
block content and are parsed recursively, so an item may contain paragraphs, a
sub-list, a code block, a component, or a blockquote. Leading tabs are expanded
to four-column tab stops. There is no lazy continuation: a line indented below
the content column ends the item.

**Loose vs tight.** A list is *loose* if a blank line separates two of its items
or two blocks within an item; otherwise it is *tight*. A tight list renders a
single-paragraph item's inline content directly inside `<li>`; a loose list wraps
each paragraph in `<p>`. The distinction is stored and round-trips.

**Task lists.** A marker may be followed by `[ ]` (unchecked) or `[x]`/`[X]`
(checked), which renders a disabled, labelled checkbox. Task items are allowed in
both ordered and unordered lists.

Nesting is bounded by the same maximum depth as components. Irregular
indentation that would merge two adjacent same-type sub-lists is reported by the
formatter (`ORVI_FORMAT_LIST_AMBIGUOUS_NESTING`).

### Blockquotes

A blockquote is a run of contiguous lines that each begin with `>` (after
optional leading whitespace). One `>` and an optional single following space are
stripped from each line, and the residual lines are parsed recursively — so a
blockquote may contain paragraphs, lists, code blocks, components, and nested
blockquotes. There is no lazy continuation: every line of the quote must carry
its `>`, and a blank line (a line with no `>`) ends the quote. A bare `>` is a
blank line inside the quote. Both `>>` and `> >` denote a second nesting level;
the renderer emits nested `<blockquote class="orvi-quote">` elements and the
formatter canonicalizes each level to `> `. Blockquote nesting is bounded by the
same maximum depth as components.

## Built-In Components

| Component | Syntax | Required | Options |
| --- | --- | --- | --- |
| `callout` | `[callout]...[/callout]` | none | `type=info|warning|success|error` |
| `grid` | `[grid 2]...[/grid]` | column count | `1` through `6` |
| `card` | `[card]...[/card]` | none | `bg=<color>` |
| `tabs` | `[tabs]...[/tabs]` | child `tab` blocks | none |
| `tab` | `[tab label=Name]...[/tab]` | `label` | none |

Component nesting defaults to a maximum depth of `8`.

Tabs are declarative. Orvi does not define user-script syntax; conforming
renderers provide tab behavior with generated HTML and CSS.

## Built-In Semantic Elements

| Element | Syntax | Required |
| --- | --- | --- |
| `btn` | `btn: Label -> https://example.com` | label and target |
| `img` | `img: ./photo.jpg | Alt text` | source and alt text |
| `hr` | `hr:` | none |
| `br` | `br:` | none |
| `badge` | `badge: Text | type=warning` | text |

`btn` accepts either `->` or the Unicode arrow shown in the guide.

`img` requires alt text. Missing alt text is a parser diagnostic.

## Built-In Modifiers

Colors: `red`, `blue`, `green`, `gray`, `muted`, `yellow`, `purple`, `orange`,
`pink`, `cyan`, `white`, `black`.

Sizes: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`.

Weights: `light`, `regular`, `medium`, `bold`.

Backgrounds use `bg=<color>`.

## Renderer Requirements

The HTML renderer emits semantic HTML with scoped CSS classes.

Accessibility requirements:

- `img` output includes the required alt text.
- `callout` output includes an appropriate role and accessible label.
- `tabs` output includes ARIA attributes that connect tab controls and panels.
- Headings, lists, tables, thematic breaks, links, and semantic elements use
  native HTML elements where available (`link`/`autolink` → `<a class="orvi-link">`
  with a sanitized `href`; `inline_code` → `<code class="orvi-code-inline">`;
  `hard_break` → `<br>`; an aligned table column → `class="orvi-align-…"`;
  `blockquote` → `<blockquote class="orvi-quote">`).

The renderer coerces an unknown `callout`/`badge` `type` or `card bg` to the
default rather than emitting it into a class name, so an invalid option (which is
also a parser diagnostic) can never inject extra class tokens.

Dark mode is a renderer/theme concern. It is selected with the renderer option
`colorScheme: "dark"` or equivalent theme configuration; Orvi has no
document-level dark-mode syntax.

Source-position annotation is an optional renderer feature: with it enabled,
every block-level element carries a `data-orvi-loc="line:column"` attribute. The
renderer may also accept a per-block override hook for custom output. Neither is
part of the document syntax.

## Error Rules

The parser never throws for syntax errors. It returns diagnostics with source
line, column, end line, and end column. Invalid documents can still produce a
partial AST, but the CLI fails builds when any error diagnostic exists.

Dynamic content and expressions such as `{name}` are unsupported and produce
diagnostics outside fenced code blocks.

Unknown metadata keys, unsupported Orvi versions, invalid metadata values,
component nesting deeper than the configured limit, and invalid `dir` values
produce diagnostics.
