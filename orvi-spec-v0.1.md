# Orvi Specification v0.1

This is the first executable Orvi specification. It formalizes the syntax used by
`orvi-language-guide.md` and the parser in this repository.

## Document Model

A Orvi document is an optional top-level metadata block followed by a sequence
of block nodes. Blank lines separate paragraphs. Line comments begin with `//`
after optional indentation and are not rendered.

Metadata is not rendered as content. v0.1 supports `orvi: 0.1`,
`title: <text>`, `lang: <language-tag>`, and `dir: ltr|rtl|auto`.

## Grammar

```ebnf
document        = [ metadata_block ] { blank | comment | block } ;
metadata_block  = "---" newline { blank | comment | metadata_entry } "---" newline ;
metadata_entry  = metadata_key ":" whitespace metadata_value newline ;
metadata_key    = "orvi" | "title" | "lang" | "dir" ;
metadata_value  = "0.1" | title_text | language_tag | "ltr" | "rtl" | "auto" ;
title_text      = bare_token { whitespace bare_token } ;
language_tag    = bare_token ;
block           = heading | thematic_break | code_block | table | list
                | component | semantic | paragraph ;

heading         = 1*6("#") whitespace inline_text newline ;
thematic_break  = "---" newline ;
comment         = whitespace "//" { any } newline ;

code_block      = fence_open { code_line } fence_close ;
fence_open      = "```" [ language ] [ "|" filename ] newline ;
fence_close     = "```" newline ;

table           = table_row table_divider table_row { table_row } ;
table_row       = [ "|" ] cell { "|" cell } [ "|" ] newline ;
table_divider   = [ "|" ] divider { "|" divider } [ "|" ] newline ;
divider         = ":"? 3*("-") ":"? ;

list            = unordered_list | ordered_list ;
unordered_list  = 1*( whitespace ("-" | "*") whitespace inline_text newline ) ;
ordered_list    = 1*( whitespace digit+ "." whitespace inline_text newline ) ;

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

inline_text     = { text | strong | emphasis | strike | inline_scope | link } ;
strong          = "**" inline_text "**" ;
emphasis        = "_" inline_text "_" ;
strike          = "~~" inline_text "~~" ;
inline_scope    = "[" modifier { whitespace modifier } "]" inline_text "[]" ;
link            = "[" inline_text "]" "(" href ")" ;   ; added in orvi-lang 1.1
modifier        = color | size | weight | "bg=" color ;
```

A `link` is recognized only when the bracket content is **not** a valid
`modifier` list (so it can never shadow an `inline_scope`): `[red](x)` is the
scope opener `[red]` followed by the text `(x)`, while `[the docs](url)` is a
link. The `href` is everything up to the first `)`; a URL containing `)` must be
percent-encoded. The renderer applies the same URL sanitizing as `btn:`/`img:`.

## Built-In Components

| Component | Syntax | Required | Options |
| --- | --- | --- | --- |
| `callout` | `[callout]...[/callout]` | none | `type=info|warning|success|error` |
| `grid` | `[grid 2]...[/grid]` | column count | `1` through `6` |
| `card` | `[card]...[/card]` | none | `bg=<color>` |
| `tabs` | `[tabs]...[/tabs]` | child `tab` blocks | none |
| `tab` | `[tab label=Name]...[/tab]` | `label` | none |

Component nesting defaults to a maximum depth of `8`.

Tabs are declarative. Orvi v0.1 does not define user-script syntax; conforming
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
  native HTML elements where available (`link` → `<a class="orvi-link">` with a
  sanitized `href`).

Dark mode is a renderer/theme concern. It is selected with the renderer option
`colorScheme: "dark"` or equivalent theme configuration; Orvi v0.1 has no
document-level dark-mode syntax.

Source-position annotation is an optional renderer feature: with it enabled,
every block-level element carries a `data-orvi-loc="line:column"` attribute. The
renderer may also accept a per-block override hook for custom output. Neither is
part of the document syntax.

## Error Rules

The parser never throws for syntax errors. It returns diagnostics with source
line, column, end line, and end column. Invalid documents can still produce a
partial AST, but the CLI fails builds when any error diagnostic exists.

Dynamic content and expressions such as `{name}` are unsupported in v0.1 and
produce diagnostics outside fenced code blocks.

Unknown metadata keys, unsupported Orvi versions, invalid metadata values,
component nesting deeper than the configured limit, and invalid `dir` values
produce diagnostics.
