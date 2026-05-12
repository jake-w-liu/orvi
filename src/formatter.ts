import {
  BlockNode,
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
  const diagnostics = [...ast.diagnostics, ...formatLossDiagnostics(source)];

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
    case "heading":
      return `${"#".repeat(block.depth)} ${formatInline(block.children)}`;
    case "paragraph":
      return formatInline(block.children).trim();
    case "thematicBreak":
      return "---";
    case "code":
      return formatCode(block.language, block.filename, block.value);
    case "table":
      return formatTable(block.headers, block.rows);
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

function formatTable(headers: InlineNode[][], rows: InlineNode[][][]): string {
  const stringHeaders = headers.map(formatInline);
  const stringRows = rows.map((row) => row.map(formatInline));
  const widths = stringHeaders.map((header, index) =>
    Math.max(header.length, ...stringRows.map((row) => row[index]?.length ?? 0), 3)
  );

  const row = (cells: string[]): string => `| ${cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join(" | ")} |`;
  const divider = `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`;

  return [row(stringHeaders), divider, ...stringRows.map(row)].join("\n");
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
          return node.value;
        case "strong":
          return `**${formatInline(node.children)}**`;
        case "emphasis":
          return `_${formatInline(node.children)}_`;
        case "strike":
          return `~~${formatInline(node.children)}~~`;
        case "scope":
          return `[${node.modifiers.map(formatModifier).join(" ")}]${formatInline(node.children)}[]`;
        default:
          return "";
      }
    })
    .join("");
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
