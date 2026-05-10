# Lux Specification v0.1

This is the first executable Lux specification. It formalizes the syntax used by
`lux-language-guide.md` and the parser in this repository.

## Document Model

A Lux document is a sequence of block nodes. Blank lines separate paragraphs.
Line comments begin with `//` after optional indentation and are not rendered.

## Grammar

```ebnf
document        = { blank | comment | block } ;
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

inline_text     = { text | strong | emphasis | strike | inline_scope } ;
strong          = "**" inline_text "**" ;
emphasis        = "_" inline_text "_" ;
strike          = "~~" inline_text "~~" ;
inline_scope    = "[" modifier { whitespace modifier } "]" inline_text "[]" ;
modifier        = color | size | weight | "bg=" color ;
```

## Built-In Components

| Component | Syntax | Required | Options |
| --- | --- | --- | --- |
| `callout` | `[callout]...[/callout]` | none | `type=info|warning|success|error` |
| `grid` | `[grid 2]...[/grid]` | column count | `1` through `6` |
| `card` | `[card]...[/card]` | none | `bg=<color>` |
| `tabs` | `[tabs]...[/tabs]` | child `tab` blocks | none |
| `tab` | `[tab label=Name]...[/tab]` | `label` | none |

## Built-In Semantic Elements

| Element | Syntax | Required |
| --- | --- | --- |
| `btn` | `btn: Label -> https://example.com` | label and target |
| `img` | `img: ./photo.jpg | Alt text` | source and alt text |
| `hr` | `hr:` | none |
| `br` | `br:` | none |
| `badge` | `badge: Text | type=warning` | text |

`btn` accepts either `->` or the Unicode arrow shown in the guide.

## Built-In Modifiers

Colors: `red`, `blue`, `green`, `gray`, `muted`, `yellow`, `purple`, `orange`,
`pink`, `cyan`, `white`, `black`.

Sizes: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`.

Weights: `light`, `regular`, `medium`, `bold`.

Backgrounds use `bg=<color>`.

## Error Rules

The parser never throws for syntax errors. It returns diagnostics with source
line and column. Invalid documents can still produce a partial AST, but the CLI
fails builds when any error diagnostic exists.
