import {
  BlockNode,
  ColumnAlignment,
  ComponentNode,
  ComponentOptions,
  DocumentMetadata,
  DocumentNode,
  InlineModifier,
  InlineNode,
  OrviDiagnostic,
  SemanticNode
} from "./ast";
import { SEMANTIC_NAMES } from "./constants";
import { parseOrvi } from "./parser";
import { walk } from "./walk";

export interface FormatOptions {
  indent?: string;
  finalNewline?: boolean;
}

export interface FormatResult {
  formatted: string;
  ast: DocumentNode;
  diagnostics: OrviDiagnostic[];
}

export function formatOrvi(source: string, options: FormatOptions = {}): FormatResult {
  const ast = parseOrvi(source);
  const indent = options.indent ?? "  ";
  const metadata = formatMetadata(ast.metadata);
  const body = [metadata, formatBlocks(ast.children, 0, indent).trimEnd()].filter(Boolean).join("\n\n");
  const formatted = options.finalNewline === false ? body : `${body}\n`;
  const diagnostics = [...ast.diagnostics, ...formatLossDiagnostics(source), ...badgeLossDiagnostics(ast)];

  return {
    formatted,
    ast,
    diagnostics
  };
}

const KNOWN_METADATA_KEYS = new Set(["orvi", "title", "lang", "dir"]);

function formatLossDiagnostics(source: string): OrviDiagnostic[] {
  const diagnostics: OrviDiagnostic[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");

  diagnostics.push(...metadataLossDiagnostics(lines));

  let inCode = false;
  lines.forEach((text, index) => {
    const trimmed = text.trim();
    if (trimmed.startsWith("```")) {
      inCode = !inCode;
      return;
    }
    if (inCode || !trimmed.startsWith("//")) return;

    const column = text.indexOf("//") + 1;
    diagnostics.push({
      severity: "warning",
      code: "ORVI_FORMAT_COMMENT_DROPPED",
      message: "The formatter does not preserve Orvi comment lines.",
      line: index + 1,
      column,
      endLine: index + 1,
      endColumn: column + trimmed.length
    });
  });

  return diagnostics;
}

function metadataLossDiagnostics(lines: string[]): OrviDiagnostic[] {
  if (lines[0]?.trim() !== "---") return [];
  const closeIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closeIndex < 0) return [];

  const diagnostics: OrviDiagnostic[] = [];
  for (let index = 1; index < closeIndex; index += 1) {
    const text = lines[index] ?? "";
    const match = /^([a-z][a-z0-9-]*):\s*(.*)$/i.exec(text.trim());
    if (!match || KNOWN_METADATA_KEYS.has(match[1]!)) continue;
    const column = Math.max(text.indexOf(match[1]!) + 1, 1);
    diagnostics.push({
      severity: "warning",
      code: "ORVI_FORMAT_METADATA_DROPPED",
      message: `The formatter does not preserve the unrecognized metadata key '${match[1]}'.`,
      line: index + 1,
      column,
      endLine: index + 1,
      endColumn: column + text.trim().length
    });
  }
  return diagnostics;
}

// A badge whose text contains a `|` immediately followed by a `key=value`
// token would, when re-emitted, be re-parsed as options (the parser treats the
// last `|` as the option separator) — truncating the text. Rather than emit a
// silently-different document, warn so callers know the source can't round-trip.
function badgeLossDiagnostics(ast: DocumentNode): OrviDiagnostic[] {
  const diagnostics: OrviDiagnostic[] = [];
  walk(ast, (node) => {
    if (node.type === "semantic" && node.name === "badge" && badgeWouldLoseContent(node)) {
      diagnostics.push({
        severity: "warning",
        code: "ORVI_FORMAT_BADGE_VALUE_DROPPED",
        message: "The formatter cannot preserve this badge text; its `| key=value` pattern re-parses as options.",
        line: node.loc.line,
        column: node.loc.column,
        endLine: node.loc.line,
        endColumn: node.loc.column + "badge".length
      });
    }
  });
  return diagnostics;
}

function badgeWouldLoseContent(node: SemanticNode): boolean {
  const value = node.value ?? "";
  const options = formatOptions(node.options ?? {});
  const payload = options ? `${value} | ${options}` : value;
  // Mirror the parser's badge payload split: only the last `|` introduces
  // options, and only when its trailing segment looks like `key=value`.
  const lastPipe = payload.lastIndexOf("|");
  const trailing = lastPipe < 0 ? "" : payload.slice(lastPipe + 1).trim();
  const hasOptions = lastPipe >= 0 && /\S=\S/.test(trailing);
  const reparsedText = (hasOptions ? payload.slice(0, lastPipe) : payload).trim();
  return reparsedText !== value;
}

function formatMetadata(metadata: DocumentMetadata): string {
  const entries: string[] = [];
  if (metadata.orvi) entries.push(`orvi: ${metadata.orvi}`);
  if (metadata.title) entries.push(`title: ${metadata.title}`);
  if (metadata.lang) entries.push(`lang: ${metadata.lang}`);
  if (metadata.dir) entries.push(`dir: ${metadata.dir}`);

  return entries.length ? ["---", ...entries, "---"].join("\n") : "";
}

function formatBlocks(blocks: BlockNode[], depth: number, indent: string): string {
  return blocks
    .map((block) => {
      const text = formatBlock(block, indent);
      // A fenced code block's body is verbatim source — only the two fence
      // lines get the component-nesting indentation, never the code text
      // (otherwise `orvi format` would mutate the code and never settle).
      return block.type === "code" ? indentFenceLines(text, depth, indent) : indentLines(text, depth, indent);
    })
    .join("\n\n");
}

function formatBlock(block: BlockNode, indent: string): string {
  switch (block.type) {
    case "heading": {
      const hashes = "#".repeat(clampHeadingDepth(block.depth));
      const content = formatInline(block.children);
      return content ? `${hashes} ${content}` : hashes;
    }
    case "paragraph":
      // Each line of a paragraph (it may span lines via a hard break) must not
      // begin with a block marker, or it would re-parse as a heading/list/
      // comment/table/etc. Inline markers are already escaped by formatInline.
      return formatInline(block.children)
        .trim()
        .split("\n")
        .map(escapeLeadingBlockMarker)
        .join("\n");
    case "thematicBreak":
      return "---";
    case "code":
      return formatCode(block.language, block.filename, block.value);
    case "table":
      return formatTable(block.headers, block.rows, block.aligns);
    case "list":
      return block.items
        .map((item, index) => {
          const marker = block.ordered ? `${index + 1}.` : "-";
          const content = formatInline(item);
          return content ? `${marker} ${content}` : marker;
        })
        .join("\n");
    case "component":
      return formatComponent(block, indent);
    case "semantic":
      return formatSemantic(block);
    default:
      return "";
  }
}

function formatComponent(node: ComponentNode, indent: string): string {
  const open = `[${[node.name, ...node.args, formatOptions(node.options)].filter(Boolean).join(" ")}]`;

  if (node.name === "grid") {
    const columns = node.columns ?? [];
    const body = columns
      .map((column) => formatBlocks(column, 1, indent))
      .join(`\n${indent}---\n`);
    return [open, body, `[/${node.name}]`].filter(Boolean).join("\n");
  }

  const body = formatBlocks(node.children, 1, indent);
  return [open, body, `[/${node.name}]`].filter(Boolean).join("\n");
}

function formatCode(language: string | undefined, filename: string | undefined, value: string): string {
  const metadata = [language, filename ? `| ${filename}` : ""].filter(Boolean).join(" ");
  return [`\`\`\`${metadata}`, value, "```"].join("\n");
}

function formatTable(headers: InlineNode[][], rows: InlineNode[][][], aligns: ColumnAlignment[] | undefined): string {
  const cell = (nodes: InlineNode[]): string => escapeTableCellPipes(formatInline(nodes));
  const stringHeaders = headers.map(cell);
  const stringRows = rows.map((row) => row.map(cell));
  const columnAlign = (index: number): ColumnAlignment => (aligns ?? [])[index] ?? "none";
  const widths = stringHeaders.map((header, index) =>
    Math.max(header.length, ...stringRows.map((row) => row[index]?.length ?? 0), minDividerWidth(columnAlign(index)))
  );

  const row = (cells: string[]): string => `| ${cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join(" | ")} |`;
  const divider = `| ${widths.map((width, index) => dividerCell(width, columnAlign(index))).join(" | ")} |`;

  return [row(stringHeaders), divider, ...stringRows.map(row)].join("\n");
}

// A colon-decorated divider cell still needs at least three dashes, so an
// aligned column reserves room for its colon(s).
function minDividerWidth(align: ColumnAlignment): number {
  if (align === "center") return 5;
  if (align === "left" || align === "right") return 4;
  return 3;
}

function dividerCell(width: number, align: ColumnAlignment): string {
  if (align === "center") return `:${"-".repeat(width - 2)}:`;
  if (align === "left") return `:${"-".repeat(width - 1)}`;
  if (align === "right") return `${"-".repeat(width - 1)}:`;
  return "-".repeat(width);
}

function formatSemantic(node: SemanticNode): string {
  if (node.name === "hr" || node.name === "br") return `${node.name}:`;
  if (node.name === "btn") return `btn: ${node.value ?? ""} -> ${node.target ?? ""}`;
  if (node.name === "img") return `img: ${node.value ?? ""} | ${node.alt ?? ""}`;

  const options = formatOptions(node.options);
  return `badge: ${node.value ?? ""}${options ? ` | ${options}` : ""}`;
}

function formatInline(nodes: InlineNode[]): string {
  return nodes
    .map((node, index) => {
      const text = formatInlineNode(node);
      // A bare autolink is greedy on its right edge: a following text node whose
      // first character is URL-valid punctuation would extend the URL on
      // re-parse. Escaping that leading punctuation inserts a `\`, which the
      // autolink scanner stops at — preserving the boundary (round-trip safety).
      const prev = nodes[index - 1];
      if (prev?.type === "link" && prev.auto === true && node.type === "text" && extendsAutolink(text)) {
        return `\\${text}`;
      }
      return text;
    })
    .join("");
}

// True when `text`, placed right after a bare autolink, would extend that URL
// on re-parse. The URL absorbs the leading run of URL-class characters (it stops
// at whitespace / `<>"\`\\|`); the autolink scanner then strips trailing
// punctuation. So a drift occurs only if that absorbed run contains a character
// the trailing-trim does NOT remove — then the leading character must be escaped
// to break the URL. The leading character must be punctuation for the escape to
// take effect; a letter/digit there can only arise behind a `\` (already
// escaped), so it is never a hazard.
function extendsAutolink(text: string): boolean {
  if (text.length === 0 || !isAsciiPunctuation(text[0]!) || text[0] === "\\") return false;
  for (const ch of text) {
    if (/[\s<>"`\\|]/.test(ch)) return false; // URL stops here — nothing past it is absorbed
    if (!/[.,;:!?'")\]]/.test(ch)) return true; // a non-trimmed URL char survives — drift
  }
  return false; // the whole absorbed run is trimmed back off
}

function formatInlineNode(node: InlineNode): string {
  switch (node.type) {
    case "text":
      return escapeInlineText(node.value);
    case "strong":
      return `**${formatInline(node.children)}**`;
    case "emphasis":
      return `${node.marker ?? "_"}${formatInline(node.children)}${node.marker ?? "_"}`;
    case "strike":
      return `~~${formatInline(node.children)}~~`;
    case "inlineCode":
      return `\`${node.value}\``;
    case "hardBreak":
      // A trailing backslash before the newline re-parses as a hard break.
      return "\\\n";
    case "scope":
      return `[${node.modifiers.map(formatModifier).join(" ")}]${formatInline(node.children)}[]`;
    case "link":
      // An autolinked bare URL re-emits as the bare URL so it round-trips
      // (wrapping it in `[url](url)` would also work but is noisier).
      return node.auto ? node.href : `[${formatInline(node.children)}](${node.href})`;
    default:
      return "";
  }
}

function isAsciiPunctuation(ch: string): boolean {
  return /^[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]$/.test(ch);
}

// Re-escape the inline-significant characters in literal text so a formatted
// text run can never be re-parsed as a construct (e.g. a literal backtick must
// not pair into an inline-code span, a literal `[` must not open a scope/link).
// Over-escaping is render-neutral (`\x` renders as `x`) and keeps the formatter
// idempotent.
function escapeInlineText(value: string): string {
  // Escape inline markers FIRST. The scheme-neutralization below must run after,
  // or the inserted backslash would itself be escaped (doubled) by this pass.
  const escaped = value.replace(/[\\`*_~[]/g, (ch) => `\\${ch}`);
  // Neutralize a literal `http(s)://` at an autolink boundary (start or after a
  // non-alphanumeric) so a round-trip renders it as text, not a link.
  return escaped.replace(/(^|[^A-Za-z0-9])(https?):\/\//gi, (_m, prefix: string, scheme: string) => `${prefix}${scheme}\\://`);
}

// In a table cell, a `|` outside an inline-code span is a column delimiter, so
// the formatter escapes it to keep the cell intact on re-parse. A `|` inside a
// `` `code` `` span is content (splitTableRow already ignores it), so it is left
// alone — escaping inside code would change the code text.
function escapeTableCellPipes(cell: string): string {
  let out = "";
  let inCode = false;
  for (const char of cell) {
    if (char === "`") inCode = !inCode;
    out += char === "|" && !inCode ? "\\|" : char;
  }
  return out;
}

// Prevent a formatted paragraph line from re-parsing as a non-paragraph block.
// Inline markers (`*`, `_`, `` ` ``, `[`, …) are already escaped upstream, so
// this only covers the block-level line starts the parser recognizes.
function escapeLeadingBlockMarker(line: string): string {
  if (line === "") return line;
  if (/^#{1,6}(\s|$)/.test(line)) return `\\${line}`; // heading
  if (line === "---") return `\\${line}`; // thematic break / grid separator
  if (/^-(\s|$)/.test(line)) return `\\${line}`; // unordered list (`*` is already inline-escaped)
  if (line.startsWith("//")) return `\\${line}`; // comment
  if (line.startsWith("```")) return `\\${line}`; // code fence
  const ordered = /^(\d+)\./.exec(line);
  if (ordered) return `${ordered[1]}\\${line.slice(ordered[1]!.length)}`; // `1.` -> `1\.`
  const semantic = /^([a-z][a-z0-9-]*):/i.exec(line);
  if (semantic && SEMANTIC_NAMES.has(semantic[1]!.toLowerCase())) {
    return `${semantic[1]}\\${line.slice(semantic[1]!.length)}`; // `btn:` -> `btn\:`
  }
  return line;
}

function formatModifier(modifier: InlineModifier): string {
  if (modifier.kind === "background") return `bg=${modifier.value}`;
  return modifier.value;
}

function formatOptions(options: ComponentOptions): string {
  return Object.entries(options)
    .map(([key, value]) => `${key}=${quoteIfNeeded(value)}`)
    .join(" ");
}

function quoteIfNeeded(value: string): string {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}

function clampHeadingDepth(depth: number): number {
  const n = Math.floor(depth);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, 6) : 1;
}

function indentLines(value: string, depth: number, indent: string): string {
  if (depth === 0) return value;
  const prefix = indent.repeat(depth);
  return value
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : line))
    .join("\n");
}

function indentFenceLines(value: string, depth: number, indent: string): string {
  if (depth === 0) return value;
  const prefix = indent.repeat(depth);
  const lines = value.split("\n");
  const last = lines.length - 1;
  return lines.map((line, index) => (index === 0 || index === last ? `${prefix}${line}` : line)).join("\n");
}
