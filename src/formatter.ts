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
      return formatInline(block.children).trim();
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
  const stringHeaders = headers.map(formatInline);
  const stringRows = rows.map((row) => row.map(formatInline));
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
    .map((node) => {
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
    })
    .join("");
}

// Re-escape the inline-significant characters in literal text so a formatted
// text run can never be re-parsed as a construct (e.g. a literal backtick must
// not pair into an inline-code span, a literal `[` must not open a scope/link).
// Over-escaping is render-neutral (`\x` renders as `x`) and keeps the formatter
// idempotent.
function escapeInlineText(value: string): string {
  return value.replace(/[\\`*_~[]/g, (ch) => `\\${ch}`);
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
