import {
  BlockNode,
  ComponentNode,
  ComponentOptions,
  DocumentNode,
  InlineModifier,
  InlineNode,
  LuxDiagnostic,
  SemanticNode
} from "./ast";
import { parseLux } from "./parser";

export interface FormatOptions {
  indent?: string;
  finalNewline?: boolean;
}

export interface FormatResult {
  formatted: string;
  ast: DocumentNode;
  diagnostics: LuxDiagnostic[];
}

export function formatLux(source: string, options: FormatOptions = {}): FormatResult {
  const ast = parseLux(source);
  const indent = options.indent ?? "  ";
  const body = formatBlocks(ast.children, 0, indent).trimEnd();
  const formatted = options.finalNewline === false ? body : `${body}\n`;

  return {
    formatted,
    ast,
    diagnostics: ast.diagnostics
  };
}

function formatBlocks(blocks: BlockNode[], depth: number, indent: string): string {
  return blocks.map((block) => indentLines(formatBlock(block, depth, indent), depth, indent)).join("\n\n");
}

function formatBlock(block: BlockNode, depth: number, indent: string): string {
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
      return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : "-"} ${formatInline(item)}`).join("\n");
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
  return [`\`\`\`${metadata ? ` ${metadata}` : ""}`, value, "```"].join("\n");
}

function formatTable(headers: InlineNode[][], rows: InlineNode[][][]): string {
  const stringHeaders = headers.map(formatInline);
  const stringRows = rows.map((row) => row.map(formatInline));
  const widths = stringHeaders.map((header, index) =>
    Math.max(header.length, ...stringRows.map((row) => row[index]?.length ?? 0), 3)
  );

  const row = (cells: string[]): string => `| ${cells.map((cell, index) => cell.padEnd(widths[index])).join(" | ")} |`;
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
