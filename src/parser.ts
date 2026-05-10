import {
  BlockNode,
  ComponentName,
  ComponentNode,
  ComponentOptions,
  DocumentNode,
  InlineModifier,
  InlineNode,
  LuxDiagnostic,
  SemanticName,
  SourceLocation,
  TableNode
} from "./ast";

interface SourceLine {
  text: string;
  line: number;
}

interface BlockResult {
  children: BlockNode[];
  closed: boolean;
}

interface OpenTag {
  name: string;
  rawArgs: string;
}

interface CloseTag {
  name: string;
}

interface TokenizedOptions {
  args: string[];
  options: ComponentOptions;
}

const COMPONENT_NAMES = new Set(["callout", "grid", "card", "tabs", "tab"]);
const SEMANTIC_NAMES = new Set(["btn", "img", "hr", "br", "badge"]);
const COLOR_NAMES = new Set([
  "red",
  "blue",
  "green",
  "gray",
  "muted",
  "yellow",
  "purple",
  "orange",
  "pink",
  "cyan",
  "white",
  "black"
]);
const SIZE_NAMES = new Set(["xs", "sm", "md", "lg", "xl", "2xl"]);
const WEIGHT_NAMES = new Set(["light", "regular", "medium", "bold"]);
const CALLOUT_TYPES = new Set(["info", "warning", "success", "error"]);

export function parseLux(source: string): DocumentNode {
  const parser = LuxParser.fromSource(source);
  return parser.parseDocument();
}

export class LuxParser {
  private index = 0;

  static fromSource(source: string): LuxParser {
    const lines = source.replace(/\r\n?/g, "\n").split("\n");
    return new LuxParser(
      lines.map((text, index) => ({ text, line: index + 1 })),
      []
    );
  }

  constructor(
    private readonly lines: SourceLine[],
    private readonly diagnostics: LuxDiagnostic[]
  ) {}

  parseDocument(): DocumentNode {
    const result = this.parseBlocks();
    return {
      type: "document",
      loc: { line: 1, column: 1 },
      children: result.children,
      diagnostics: this.diagnostics
    };
  }

  private parseBlocks(stopTag?: ComponentName): BlockResult {
    const children: BlockNode[] = [];

    while (!this.isEnd()) {
      const line = this.current();
      const trimmed = line.text.trim();

      if (trimmed === "" || trimmed.startsWith("//")) {
        this.index += 1;
        continue;
      }

      const close = parseCloseTag(trimmed);
      if (close) {
        if (stopTag && close.name === stopTag) {
          this.index += 1;
          return { children, closed: true };
        }
        this.error("LUX_UNEXPECTED_CLOSE", `Unexpected closing tag [/${close.name}].`, line);
        this.index += 1;
        continue;
      }

      if (trimmed.startsWith("```")) {
        children.push(this.parseCodeBlock());
        continue;
      }

      if (this.isTableStart()) {
        children.push(this.parseTable());
        continue;
      }

      const open = parseOpenTag(trimmed);
      if (open) {
        if (!isComponentName(open.name)) {
          this.error("LUX_UNKNOWN_COMPONENT", `Unknown block component [${open.name}].`, line);
          this.index += 1;
          continue;
        }
        children.push(this.parseComponent(open, line, stopTag));
        continue;
      }

      const semantic = this.parseSemanticLine(line);
      if (semantic) {
        children.push(semantic);
        continue;
      }

      const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
      if (heading) {
        children.push({
          type: "heading",
          loc: loc(line),
          depth: heading[1].length,
          children: this.parseInline(heading[2], line.line, line.text.indexOf(heading[2]) + 1)
        });
        this.index += 1;
        continue;
      }

      if (trimmed === "---") {
        children.push({ type: "thematicBreak", loc: loc(line) });
        this.index += 1;
        continue;
      }

      if (isListLine(trimmed)) {
        children.push(this.parseList());
        continue;
      }

      children.push(this.parseParagraph());
    }

    return { children, closed: stopTag === undefined };
  }

  private parseComponent(open: OpenTag, line: SourceLine, parent?: ComponentName): ComponentNode {
    const { args, options } = tokenizeOptions(open.rawArgs);
    const node: ComponentNode = {
      type: "component",
      loc: loc(line),
      name: open.name as ComponentName,
      args,
      options,
      children: []
    };

    this.validateComponentOpen(node, line, parent);
    this.index += 1;

    if (node.name === "grid") {
      const { columns, closed } = this.parseGridColumns(line);
      node.columns = columns;
      if (!closed) {
        this.error("LUX_UNCLOSED_BLOCK", "Unclosed [grid] block.", line);
      }
      this.validateGridShape(node, line);
      return node;
    }

    const result = this.parseBlocks(node.name);
    node.children = result.children;
    if (!result.closed) {
      this.error("LUX_UNCLOSED_BLOCK", `Unclosed [${node.name}] block.`, line);
    }
    this.validateComponentChildren(node, line);
    return node;
  }

  private parseGridColumns(openingLine: SourceLine): { columns: BlockNode[][]; closed: boolean } {
    const sections: SourceLine[][] = [[]];
    let depth = 0;
    let inFence = false;

    while (!this.isEnd()) {
      const line = this.current();
      const trimmed = line.text.trim();

      if (trimmed.startsWith("```")) {
        inFence = !inFence;
        sections[sections.length - 1].push(line);
        this.index += 1;
        continue;
      }

      if (!inFence) {
        const close = parseCloseTag(trimmed);
        if (close) {
          if (close.name === "grid" && depth === 0) {
            this.index += 1;
            return {
              columns: sections.map((section) => this.parseNestedLines(section)),
              closed: true
            };
          }
          if (depth > 0) {
            depth -= 1;
          }
          sections[sections.length - 1].push(line);
          this.index += 1;
          continue;
        }

        const open = parseOpenTag(trimmed);
        if (open) {
          if (isComponentName(open.name)) {
            depth += 1;
          } else {
            this.error("LUX_UNKNOWN_COMPONENT", `Unknown block component [${open.name}].`, line);
          }
          sections[sections.length - 1].push(line);
          this.index += 1;
          continue;
        }

        if (trimmed === "---" && depth === 0) {
          sections.push([]);
          this.index += 1;
          continue;
        }
      }

      sections[sections.length - 1].push(line);
      this.index += 1;
    }

    this.error("LUX_UNCLOSED_BLOCK", "Unclosed [grid] block.", openingLine);
    return {
      columns: sections.map((section) => this.parseNestedLines(section)),
      closed: false
    };
  }

  private parseNestedLines(lines: SourceLine[]): BlockNode[] {
    const parser = new LuxParser(lines, this.diagnostics);
    return parser.parseBlocks().children;
  }

  private parseCodeBlock(): BlockNode {
    const opening = this.current();
    const trimmed = opening.text.trim();
    const meta = trimmed.slice(3).trim();
    const [languagePart, filenamePart] = meta.split("|").map((part) => part.trim());
    const language = languagePart || undefined;
    const filename = filenamePart || undefined;
    const body: string[] = [];
    this.index += 1;

    while (!this.isEnd()) {
      const line = this.current();
      if (line.text.trim().startsWith("```")) {
        this.index += 1;
        return {
          type: "code",
          loc: loc(opening),
          language,
          filename,
          value: body.join("\n")
        };
      }
      body.push(line.text);
      this.index += 1;
    }

    this.error("LUX_UNCLOSED_CODE", "Unclosed code block.", opening);
    return {
      type: "code",
      loc: loc(opening),
      language,
      filename,
      value: body.join("\n")
    };
  }

  private parseTable(): TableNode {
    const start = this.current();
    const headerCells = splitTableRow(start.text);
    const width = headerCells.length;
    this.index += 2;

    const rows: InlineNode[][][] = [];
    while (!this.isEnd()) {
      const line = this.current();
      const trimmed = line.text.trim();
      if (trimmed === "" || !trimmed.includes("|") || this.isBlockBoundary(line)) {
        break;
      }
      const rowCells = splitTableRow(line.text);
      if (rowCells.length !== width) {
        this.error(
          "LUX_TABLE_WIDTH_MISMATCH",
          `Table row has ${rowCells.length} cells but header has ${width}.`,
          line
        );
      }
      rows.push(rowCells.map((cell) => this.parseInline(cell, line.line, line.text.indexOf(cell) + 1)));
      this.index += 1;
    }

    return {
      type: "table",
      loc: loc(start),
      headers: headerCells.map((cell) => this.parseInline(cell, start.line, start.text.indexOf(cell) + 1)),
      rows
    };
  }

  private parseList(): BlockNode {
    const start = this.current();
    const first = start.text.trim();
    const ordered = /^\d+\.\s+/.test(first);
    const items: InlineNode[][] = [];

    while (!this.isEnd()) {
      const line = this.current();
      const trimmed = line.text.trim();
      const match = ordered ? /^\d+\.\s+(.+)$/.exec(trimmed) : /^[-*]\s+(.+)$/.exec(trimmed);
      if (!match) {
        break;
      }
      items.push(this.parseInline(match[1], line.line, line.text.indexOf(match[1]) + 1));
      this.index += 1;
    }

    return {
      type: "list",
      loc: loc(start),
      ordered,
      items
    };
  }

  private parseParagraph(): BlockNode {
    const start = this.current();
    const parts: string[] = [];

    while (!this.isEnd()) {
      const line = this.current();
      if (this.isBlockBoundary(line)) {
        break;
      }
      parts.push(line.text.trim());
      this.index += 1;
    }

    const value = parts.join(" ");
    return {
      type: "paragraph",
      loc: loc(start),
      children: this.parseInline(value, start.line, firstContentColumn(start.text))
    };
  }

  private parseSemanticLine(line: SourceLine): BlockNode | undefined {
    const match = /^([a-z][a-z0-9-]*):(?:\s*(.*))?$/i.exec(line.text.trim());
    if (!match || !SEMANTIC_NAMES.has(match[1])) {
      return undefined;
    }

    this.index += 1;
    const name = match[1] as SemanticName;
    const payload = (match[2] ?? "").trim();
    const base = {
      type: "semantic" as const,
      loc: loc(line),
      name,
      options: {}
    };

    if (name === "hr" || name === "br") {
      if (payload !== "") {
        this.error("LUX_UNEXPECTED_PAYLOAD", `${name}: does not accept content.`, line);
      }
      return base;
    }

    if (name === "btn") {
      const parts = payload.split(/\s*(?:->|→)\s*/u);
      if (parts.length < 2 || !parts[0] || !parts.slice(1).join("->")) {
        this.error("LUX_INVALID_SEMANTIC", "btn: requires `Label -> target`.", line);
      }
      return {
        ...base,
        value: parts[0]?.trim() ?? "",
        target: parts.slice(1).join("->").trim()
      };
    }

    const [valuePart, optionPart] = payload.split("|").map((part) => part.trim());
    const { options } = tokenizeOptions(optionPart ?? "");

    if (name === "img") {
      if (!valuePart || !optionPart) {
        this.error("LUX_INVALID_SEMANTIC", "img: requires `source | alt text`.", line);
      }
      return {
        ...base,
        value: valuePart ?? "",
        alt: optionPart ?? ""
      };
    }

    if (!valuePart) {
      this.error("LUX_INVALID_SEMANTIC", "badge: requires text.", line);
    }
    if (options.type && !CALLOUT_TYPES.has(options.type)) {
      this.error("LUX_INVALID_OPTION", `Unknown badge type '${options.type}'.`, line);
    }
    return {
      ...base,
      value: valuePart ?? "",
      options
    };
  }

  private parseInline(value: string, line: number, column: number): InlineNode[] {
    const nodes: InlineNode[] = [];
    let index = 0;

    const pushText = (text: string, offset: number): void => {
      if (text.length > 0) {
        nodes.push({ type: "text", loc: { line, column: column + offset }, value: text });
      }
    };

    while (index < value.length) {
      if (value.startsWith("**", index)) {
        const close = value.indexOf("**", index + 2);
        if (close >= 0) {
          nodes.push({
            type: "strong",
            loc: { line, column: column + index },
            children: this.parseInline(value.slice(index + 2, close), line, column + index + 2)
          });
          index = close + 2;
          continue;
        }
      }

      if (value.startsWith("~~", index)) {
        const close = value.indexOf("~~", index + 2);
        if (close >= 0) {
          nodes.push({
            type: "strike",
            loc: { line, column: column + index },
            children: this.parseInline(value.slice(index + 2, close), line, column + index + 2)
          });
          index = close + 2;
          continue;
        }
      }

      if (value[index] === "_") {
        const close = value.indexOf("_", index + 1);
        if (close > index + 1) {
          nodes.push({
            type: "emphasis",
            loc: { line, column: column + index },
            children: this.parseInline(value.slice(index + 1, close), line, column + index + 1)
          });
          index = close + 1;
          continue;
        }
      }

      if (value[index] === "[" && !value.startsWith("[]", index)) {
        const bracketClose = value.indexOf("]", index + 1);
        if (bracketClose > index + 1) {
          const rawModifiers = value.slice(index + 1, bracketClose).trim();
          const modifiers = this.parseInlineModifiers(rawModifiers, { line, column: column + index + 1 }, true);
          if (modifiers) {
            const scopeClose = this.findScopeClose(value, bracketClose + 1);
            if (scopeClose >= 0) {
              nodes.push({
                type: "scope",
                loc: { line, column: column + index },
                modifiers,
                children: this.parseInline(value.slice(bracketClose + 1, scopeClose), line, column + bracketClose + 1)
              });
              index = scopeClose + 2;
              continue;
            }
            this.errorAt("LUX_UNCLOSED_SCOPE", "Unclosed inline scope; expected [].", line, column + index);
          }
        }
      }

      const next = this.nextInlineToken(value, index + 1);
      pushText(value.slice(index, next), index);
      index = next;
    }

    return nodes;
  }

  private parseInlineModifiers(raw: string, loc: SourceLocation, report: boolean): InlineModifier[] | undefined {
    const tokens = raw.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      if (report) this.errorAt("LUX_INVALID_MODIFIER", "Inline scope requires at least one modifier.", loc.line, loc.column);
      return undefined;
    }

    const modifiers: InlineModifier[] = [];
    for (const token of tokens) {
      if (COLOR_NAMES.has(token)) {
        modifiers.push({ kind: "color", value: token });
      } else if (SIZE_NAMES.has(token)) {
        modifiers.push({ kind: "size", value: token });
      } else if (WEIGHT_NAMES.has(token)) {
        modifiers.push({ kind: "weight", value: token });
      } else if (token.startsWith("bg=") && COLOR_NAMES.has(token.slice(3))) {
        modifiers.push({ kind: "background", value: token.slice(3) });
      } else {
        if (report) this.errorAt("LUX_INVALID_MODIFIER", `Unknown inline modifier '${token}'.`, loc.line, loc.column);
        return undefined;
      }
    }

    return modifiers;
  }

  private findScopeClose(value: string, start: number): number {
    let depth = 1;
    let index = start;

    while (index < value.length) {
      if (value.startsWith("[]", index)) {
        depth -= 1;
        if (depth === 0) return index;
        index += 2;
        continue;
      }

      if (value[index] === "[") {
        const bracketClose = value.indexOf("]", index + 1);
        if (bracketClose > index + 1) {
          const raw = value.slice(index + 1, bracketClose).trim();
          if (this.parseInlineModifiers(raw, { line: 0, column: 0 }, false)) {
            depth += 1;
            index = bracketClose + 1;
            continue;
          }
        }
      }

      index += 1;
    }

    return -1;
  }

  private nextInlineToken(value: string, start: number): number {
    const candidates = ["**", "~~", "_", "["]
      .map((token) => value.indexOf(token, start))
      .filter((candidate) => candidate >= 0);
    return candidates.length === 0 ? value.length : Math.min(...candidates);
  }

  private validateComponentOpen(node: ComponentNode, line: SourceLine, parent: ComponentName | undefined): void {
    this.validateComponentArguments(node, line);
    this.validateComponentOptions(node, line);

    if (node.name === "callout" && node.options.type && !CALLOUT_TYPES.has(node.options.type)) {
      this.error("LUX_INVALID_OPTION", `Unknown callout type '${node.options.type}'.`, line);
    }

    if (node.name === "grid") {
      const count = Number(node.args[0]);
      if (!Number.isInteger(count) || count < 1 || count > 6 || node.args.length !== 1) {
        this.error("LUX_INVALID_GRID", "grid requires one column count from 1 to 6.", line);
      }
    }

    if (node.name === "card" && node.options.bg && !COLOR_NAMES.has(node.options.bg)) {
      this.error("LUX_INVALID_OPTION", `Unknown card background '${node.options.bg}'.`, line);
    }

    if (node.name === "tab" && !node.options.label) {
      this.error("LUX_INVALID_TAB", "tab requires label=<text>.", line);
    }

    if (node.name === "tab" && parent !== "tabs") {
      this.error("LUX_INVALID_TAB", "tab blocks must be direct children of [tabs].", line);
    }
  }

  private validateComponentChildren(node: ComponentNode, line: SourceLine): void {
    if (node.name !== "tabs") return;

    const tabChildren = node.children.filter((child) => child.type === "component" && child.name === "tab");
    if (tabChildren.length === 0) {
      this.error("LUX_INVALID_TABS", "tabs requires at least one [tab] child.", line);
    }

    for (const child of node.children) {
      if (child.type !== "component" || child.name !== "tab") {
        this.errorAt(
          "LUX_INVALID_TABS_CHILD",
          "Only [tab] blocks may be direct children of [tabs].",
          child.loc.line,
          child.loc.column
        );
      }
    }
  }

  private validateComponentArguments(node: ComponentNode, line: SourceLine): void {
    if (node.name === "grid") return;
    if (node.args.length > 0) {
      this.error("LUX_UNEXPECTED_ARGUMENT", `[${node.name}] does not accept positional arguments.`, line);
    }
  }

  private validateComponentOptions(node: ComponentNode, line: SourceLine): void {
    const allowedOptions: Record<ComponentName, string[]> = {
      callout: ["type"],
      grid: [],
      card: ["bg"],
      tabs: [],
      tab: ["label"]
    };

    for (const option of Object.keys(node.options)) {
      if (!allowedOptions[node.name].includes(option)) {
        this.error("LUX_UNKNOWN_OPTION", `[${node.name}] does not support option '${option}'.`, line);
      }
    }
  }

  private validateGridShape(node: ComponentNode, line: SourceLine): void {
    const declared = Number(node.args[0]);
    if (Number.isInteger(declared) && node.columns && node.columns.length !== declared) {
      this.error("LUX_GRID_MISMATCH", `grid declared ${declared} columns but found ${node.columns.length}.`, line);
    }
  }

  private isTableStart(): boolean {
    if (this.index + 1 >= this.lines.length) return false;
    const current = this.current().text.trim();
    const next = this.lines[this.index + 1].text.trim();
    return current.includes("|") && isTableDivider(next);
  }

  private isBlockBoundary(line: SourceLine): boolean {
    const trimmed = line.text.trim();
    if (trimmed === "" || trimmed.startsWith("//")) return true;
    if (trimmed.startsWith("```")) return true;
    if (parseCloseTag(trimmed) || parseOpenTag(trimmed)) return true;
    if (/^(#{1,6})\s+/.test(trimmed)) return true;
    if (trimmed === "---") return true;
    if (isListLine(trimmed)) return true;
    if (/^([a-z][a-z0-9-]*):(?:\s*(.*))?$/i.test(trimmed) && SEMANTIC_NAMES.has(trimmed.split(":")[0])) return true;
    return false;
  }

  private current(): SourceLine {
    return this.lines[this.index];
  }

  private isEnd(): boolean {
    return this.index >= this.lines.length;
  }

  private error(code: string, message: string, line: SourceLine): void {
    this.errorAt(code, message, line.line, firstContentColumn(line.text));
  }

  private errorAt(code: string, message: string, line: number, column: number): void {
    this.diagnostics.push({
      severity: "error",
      code,
      message,
      line,
      column
    });
  }
}

function parseOpenTag(trimmed: string): OpenTag | undefined {
  const match = /^\[([a-z][a-z0-9-]*)(?:\s+([^\]]+))?\]$/i.exec(trimmed);
  if (!match) return undefined;
  return {
    name: match[1],
    rawArgs: match[2] ?? ""
  };
}

function isComponentName(name: string): name is ComponentName {
  return COMPONENT_NAMES.has(name);
}

function parseCloseTag(trimmed: string): CloseTag | undefined {
  const match = /^\[\/([a-z][a-z0-9-]*)\]$/i.exec(trimmed);
  if (!match) return undefined;
  return { name: match[1] };
}

function tokenizeOptions(raw: string): TokenizedOptions {
  const args: string[] = [];
  const options: ComponentOptions = {};
  const tokens = raw.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];

  for (const token of tokens) {
    const cleaned = stripQuotes(token);
    const equals = cleaned.indexOf("=");
    if (equals > 0) {
      options[cleaned.slice(0, equals)] = cleaned.slice(equals + 1);
    } else if (cleaned) {
      args.push(cleaned);
    }
  }

  return { args, options };
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function splitTableRow(row: string): string[] {
  let value = row.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  return value.split("|").map((cell) => cell.trim());
}

function isTableDivider(value: string): boolean {
  const cells = splitTableRow(value);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function isListLine(trimmed: string): boolean {
  return /^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed);
}

function loc(line: SourceLine): SourceLocation {
  return { line: line.line, column: firstContentColumn(line.text) };
}

function firstContentColumn(value: string): number {
  const match = /\S/.exec(value);
  return match ? match.index + 1 : 1;
}
