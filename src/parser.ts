import {
  BlockNode,
  ComponentName,
  ComponentNode,
  ComponentOptions,
  DocumentMetadata,
  DocumentNode,
  InlineModifier,
  InlineNode,
  OrviDiagnostic,
  SemanticName,
  SourceLocation,
  TableNode
} from "./ast";

export interface ParserOptions {
  maxNestingDepth?: number;
  supportedVersion?: string;
}

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
const DEFAULT_MAX_NESTING_DEPTH = 8;
const DEFAULT_SUPPORTED_VERSION = "0.1";
const METADATA_KEYS = new Set(["orvi", "title", "lang", "dir"]);

export function parseOrvi(source: string, options: ParserOptions = {}): DocumentNode {
  const parser = OrviParser.fromSource(source, options);
  return parser.parseDocument();
}

export class OrviParser {
  private index = 0;
  private readonly options: Required<ParserOptions>;

  static fromSource(source: string, options: ParserOptions = {}): OrviParser {
    const lines = source.replace(/\r\n?/g, "\n").split("\n");
    return new OrviParser(
      lines.map((text, index) => ({ text, line: index + 1 })),
      [],
      normalizeOptions(options)
    );
  }

  constructor(
    private readonly lines: SourceLine[],
    private readonly diagnostics: OrviDiagnostic[],
    options: Required<ParserOptions>
  ) {
    this.options = options;
  }

  parseDocument(): DocumentNode {
    const metadata = this.parseMetadata();
    const result = this.parseBlocks();
    return {
      type: "document",
      loc: { line: 1, column: 1 },
      metadata,
      children: result.children,
      diagnostics: this.diagnostics
    };
  }

  private parseMetadata(): DocumentMetadata {
    if (!this.isMetadataStart()) {
      return {};
    }

    const start = this.current();
    const hasClose = this.lines.some((line, index) => index > 0 && line.text.trim() === "---");
    this.index += 1;
    const metadata: DocumentMetadata = {};

    while (!this.isEnd()) {
      const line = this.current();
      const trimmed = line.text.trim();
      if (trimmed === "---") {
        this.index += 1;
        this.validateMetadata(metadata, start);
        return metadata;
      }

      if (trimmed === "" || trimmed.startsWith("//")) {
        this.index += 1;
        continue;
      }

      const match = /^([a-z][a-z0-9-]*):\s*(.*)$/i.exec(trimmed);
      if (!match) {
        if (!hasClose) {
          this.error("ORVI_UNCLOSED_METADATA", "Unclosed metadata block; expected a closing `---`.", start);
          this.validateMetadata(metadata, start);
          return metadata;
        }
        this.error("ORVI_INVALID_METADATA", "Metadata entries must use `key: value` syntax.", line);
        this.index += 1;
        continue;
      }

      const key = match[1];
      const value = match[2].trim();
      if (!METADATA_KEYS.has(key)) {
        this.warning("ORVI_UNKNOWN_METADATA", `Unknown metadata key '${key}'.`, line);
      } else if (key === "dir") {
        if (value === "ltr" || value === "rtl" || value === "auto") {
          metadata.dir = value;
        } else {
          this.error("ORVI_INVALID_METADATA", "dir metadata must be ltr, rtl, or auto.", line);
        }
      } else if (key === "orvi") {
        metadata.orvi = value;
      } else if (key === "title") {
        metadata.title = value;
      } else if (key === "lang") {
        if (/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(value)) {
          metadata.lang = value;
        } else {
          this.error("ORVI_INVALID_METADATA", "lang metadata must be a valid BCP 47-style tag.", line);
        }
      }

      this.index += 1;
    }

    this.error("ORVI_UNCLOSED_METADATA", "Unclosed metadata block; expected a closing `---`.", start);
    this.validateMetadata(metadata, start);
    return metadata;
  }

  private parseBlocks(stopTag?: ComponentName, depth = 0): BlockResult {
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
        this.error("ORVI_UNEXPECTED_CLOSE", `Unexpected closing tag [/${close.name}].`, line);
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
          this.error("ORVI_UNKNOWN_COMPONENT", `Unknown block component [${open.name}].`, line);
          this.index += 1;
          continue;
        }
        children.push(this.parseComponent(open, line, stopTag, depth));
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

  private parseComponent(open: OpenTag, line: SourceLine, parent: ComponentName | undefined, depth: number): ComponentNode {
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
    if (depth >= this.options.maxNestingDepth) {
      this.error(
        "ORVI_MAX_NESTING_DEPTH",
        `Component nesting exceeds max depth ${this.options.maxNestingDepth}.`,
        line
      );
    }
    this.index += 1;

    if (node.name === "grid") {
      const { columns, closed } = this.parseGridColumns(line, depth);
      node.columns = columns;
      if (!closed) {
        this.error("ORVI_UNCLOSED_BLOCK", "Unclosed [grid] block.", line);
      }
      this.validateGridShape(node, line);
      return node;
    }

    const result = this.parseBlocks(node.name, depth + 1);
    node.children = result.children;
    if (!result.closed) {
      this.error("ORVI_UNCLOSED_BLOCK", `Unclosed [${node.name}] block.`, line);
    }
    this.validateComponentChildren(node, line);
    return node;
  }

  private parseGridColumns(openingLine: SourceLine, depth: number): { columns: BlockNode[][]; closed: boolean } {
    const sections: SourceLine[][] = [[]];
    let separatorDepth = 0;
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
          if (close.name === "grid" && separatorDepth === 0) {
            this.index += 1;
            return {
              columns: sections.map((section) => this.parseNestedLines(section, depth + 1)),
              closed: true
            };
          }
          if (separatorDepth > 0) {
            separatorDepth -= 1;
          }
          sections[sections.length - 1].push(line);
          this.index += 1;
          continue;
        }

        const open = parseOpenTag(trimmed);
        if (open) {
          if (isComponentName(open.name)) {
            separatorDepth += 1;
          } else {
            this.error("ORVI_UNKNOWN_COMPONENT", `Unknown block component [${open.name}].`, line);
          }
          sections[sections.length - 1].push(line);
          this.index += 1;
          continue;
        }

        if (trimmed === "---" && separatorDepth === 0) {
          sections.push([]);
          this.index += 1;
          continue;
        }
      }

      sections[sections.length - 1].push(line);
      this.index += 1;
    }

    this.error("ORVI_UNCLOSED_BLOCK", "Unclosed [grid] block.", openingLine);
    return {
      columns: sections.map((section) => this.parseNestedLines(section, depth + 1)),
      closed: false
    };
  }

  private parseNestedLines(lines: SourceLine[], depth: number): BlockNode[] {
    const parser = new OrviParser(lines, this.diagnostics, this.options);
    return parser.parseBlocks(undefined, depth).children;
  }

  private parseCodeBlock(): BlockNode {
    const opening = this.current();
    const trimmed = opening.text.trim();
    const meta = trimmed.slice(3).trim();
    const [languagePart, filenamePart] = meta.split("|").map((part) => part.trim());
    const languageToken = languagePart ? languagePart.split(/\s+/)[0] : "";
    const language = languageToken && /^[\w.+#-]+$/.test(languageToken) ? languageToken : undefined;
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

    this.error("ORVI_UNCLOSED_CODE", "Unclosed code block.", opening);
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
          "ORVI_TABLE_WIDTH_MISMATCH",
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
    const collected: SourceLine[] = [];

    while (!this.isEnd()) {
      const line = this.current();
      if (this.isBlockBoundary(line)) {
        break;
      }
      collected.push(line);
      this.index += 1;
    }

    for (const line of collected) {
      this.validateDynamicContent(line.text, line.line, 1);
    }

    const value = collected.map((line) => line.text.trim()).join(" ");
    return {
      type: "paragraph",
      loc: loc(start),
      children: this.parseInline(value, start.line, firstContentColumn(start.text), false)
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
        this.error("ORVI_UNEXPECTED_PAYLOAD", `${name}: does not accept content.`, line);
      }
      return base;
    }

    if (name === "btn") {
      const arrow = /^(.*?)\s*(?:->|→)\s*(.*)$/u.exec(payload);
      const label = arrow ? arrow[1].trim() : "";
      const target = arrow ? arrow[2].trim() : "";
      if (!arrow || !label || !target) {
        this.error("ORVI_INVALID_SEMANTIC", "btn: requires `Label -> target`.", line);
      }
      return {
        ...base,
        value: label,
        target
      };
    }

    const [valuePart, optionPart] = payload.split("|").map((part) => part.trim());
    const { options } = tokenizeOptions(optionPart ?? "");

    if (name === "img") {
      if (!valuePart || !optionPart) {
        this.error("ORVI_INVALID_SEMANTIC", "img: requires `source | alt text`.", line);
      }
      return {
        ...base,
        value: valuePart ?? "",
        alt: optionPart ?? ""
      };
    }

    if (!valuePart) {
      this.error("ORVI_INVALID_SEMANTIC", "badge: requires text.", line);
    }
    if (options.type && !CALLOUT_TYPES.has(options.type)) {
      this.error("ORVI_INVALID_OPTION", `Unknown badge type '${options.type}'.`, line);
    }
    return {
      ...base,
      value: valuePart ?? "",
      options
    };
  }

  private parseInline(value: string, line: number, column: number, validateDynamic = true): InlineNode[] {
    const nodes: InlineNode[] = [];
    let index = 0;

    if (validateDynamic) {
      this.validateDynamicContent(value, line, column);
    }

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
            children: this.parseInline(value.slice(index + 2, close), line, column + index + 2, false)
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
            children: this.parseInline(value.slice(index + 2, close), line, column + index + 2, false)
          });
          index = close + 2;
          continue;
        }
      }

      if (value[index] === "_" && canOpenEmphasis(value, index)) {
        const close = findEmphasisClose(value, index + 1);
        if (close > index + 1) {
          nodes.push({
            type: "emphasis",
            loc: { line, column: column + index },
            children: this.parseInline(value.slice(index + 1, close), line, column + index + 1, false)
          });
          index = close + 1;
          continue;
        }
      }

      if (value[index] === "[" && !value.startsWith("[]", index)) {
        const bracketClose = value.indexOf("]", index + 1);
        if (bracketClose > index + 1) {
          const rawModifiers = value.slice(index + 1, bracketClose).trim();
          const modifiers = this.parseInlineModifiers(rawModifiers, { line, column: column + index + 1 }, false);
          if (modifiers) {
            const scopeClose = this.findScopeClose(value, bracketClose + 1);
            if (scopeClose >= 0) {
              nodes.push({
                type: "scope",
                loc: { line, column: column + index },
                modifiers,
                children: this.parseInline(value.slice(bracketClose + 1, scopeClose), line, column + bracketClose + 1, false)
              });
              index = scopeClose + 2;
              continue;
            }
            this.errorAt("ORVI_UNCLOSED_SCOPE", "Unclosed inline scope; expected [].", line, column + index);
          } else if (value.indexOf("[]", bracketClose + 1) >= 0) {
            this.parseInlineModifiers(rawModifiers, { line, column: column + index + 1 }, true);
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
      if (report) this.errorAt("ORVI_INVALID_MODIFIER", "Inline scope requires at least one modifier.", loc.line, loc.column);
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
        if (report) this.errorAt("ORVI_INVALID_MODIFIER", `Unknown inline modifier '${token}'.`, loc.line, loc.column);
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
      this.error("ORVI_INVALID_OPTION", `Unknown callout type '${node.options.type}'.`, line);
    }

    if (node.name === "grid") {
      const count = Number(node.args[0]);
      if (!Number.isInteger(count) || count < 1 || count > 6 || node.args.length !== 1) {
        this.error("ORVI_INVALID_GRID", "grid requires one column count from 1 to 6.", line);
      }
    }

    if (node.name === "card" && node.options.bg && !COLOR_NAMES.has(node.options.bg)) {
      this.error("ORVI_INVALID_OPTION", `Unknown card background '${node.options.bg}'.`, line);
    }

    if (node.name === "tab" && !node.options.label) {
      this.error("ORVI_INVALID_TAB", "tab requires label=<text>.", line);
    }

    if (node.name === "tab" && parent !== "tabs") {
      this.error("ORVI_INVALID_TAB", "tab blocks must be direct children of [tabs].", line);
    }
  }

  private validateComponentChildren(node: ComponentNode, line: SourceLine): void {
    if (node.name !== "tabs") return;

    const tabChildren = node.children.filter((child) => child.type === "component" && child.name === "tab");
    if (tabChildren.length === 0) {
      this.error("ORVI_INVALID_TABS", "tabs requires at least one [tab] child.", line);
    }

    for (const child of node.children) {
      if (child.type !== "component" || child.name !== "tab") {
        this.errorAt(
          "ORVI_INVALID_TABS_CHILD",
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
      this.error("ORVI_UNEXPECTED_ARGUMENT", `[${node.name}] does not accept positional arguments.`, line);
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
        this.error("ORVI_UNKNOWN_OPTION", `[${node.name}] does not support option '${option}'.`, line);
      }
    }
  }

  private validateGridShape(node: ComponentNode, line: SourceLine): void {
    const declared = Number(node.args[0]);
    if (Number.isInteger(declared) && node.columns && node.columns.length !== declared) {
      this.error("ORVI_GRID_MISMATCH", `grid declared ${declared} columns but found ${node.columns.length}.`, line);
    }
  }

  private validateMetadata(metadata: DocumentMetadata, line: SourceLine): void {
    if (!metadata.orvi) return;
    if (metadata.orvi !== this.options.supportedVersion) {
      this.error(
        "ORVI_UNSUPPORTED_VERSION",
        `Unsupported Orvi version '${metadata.orvi}'; expected '${this.options.supportedVersion}'.`,
        line
      );
    }
  }

  private validateDynamicContent(value: string, line: number, column: number): void {
    const dynamicPattern = /\{[A-Za-z_][A-Za-z0-9_.-]*\}/g;
    for (const match of value.matchAll(dynamicPattern)) {
      this.errorAt(
        "ORVI_DYNAMIC_CONTENT_UNSUPPORTED",
        "Dynamic expressions are not supported in Orvi v0.1.",
        line,
        column + (match.index ?? 0),
        match[0].length
      );
    }
  }

  private isTableStart(): boolean {
    if (this.index + 1 >= this.lines.length) return false;
    const current = this.current().text.trim();
    if (!current.includes("|")) return false;
    const next = this.lines[this.index + 1].text.trim();
    const headerCells = splitTableRow(current);
    const dividerCells = splitTableRow(next);
    return (
      headerCells.length >= 1 &&
      headerCells.length === dividerCells.length &&
      dividerCells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
    );
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

  private isMetadataStart(): boolean {
    if (this.index !== 0 || this.lines.length < 2) return false;
    if (this.lines[0].text.trim() !== "---") return false;
    const entryPattern = /^([a-z][a-z0-9-]*):\s*(.*)$/i;
    const closeIndex = this.lines.findIndex((line, index) => index > 0 && line.text.trim() === "---");
    if (closeIndex >= 0) {
      return this.lines.slice(1, closeIndex).some((line) => entryPattern.test(line.text.trim()));
    }
    // No closing `---`: still treat this as a metadata block when the first line already looks
    // like an entry, so the author gets an ORVI_UNCLOSED_METADATA diagnostic instead of silence.
    return entryPattern.test((this.lines[1]?.text ?? "").trim());
  }

  private error(code: string, message: string, line: SourceLine): void {
    this.errorAt(code, message, line.line, firstContentColumn(line.text), diagnosticLength(line.text));
  }

  private warning(code: string, message: string, line: SourceLine): void {
    const column = firstContentColumn(line.text);
    this.diagnostics.push({
      severity: "warning",
      code,
      message,
      line: line.line,
      column,
      endLine: line.line,
      endColumn: column + diagnosticLength(line.text)
    });
  }

  private errorAt(code: string, message: string, line: number, column: number, length = 1): void {
    this.diagnostics.push({
      severity: "error",
      code,
      message,
      line,
      column,
      endLine: line,
      endColumn: column + Math.max(length, 1)
    });
  }
}

function normalizeOptions(options: ParserOptions): Required<ParserOptions> {
  return {
    maxNestingDepth: options.maxNestingDepth ?? DEFAULT_MAX_NESTING_DEPTH,
    supportedVersion: options.supportedVersion ?? DEFAULT_SUPPORTED_VERSION
  };
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
  const tokens = scanOptionTokens(raw);

  for (const token of tokens) {
    const equals = indexOfUnquotedEquals(token);
    if (equals > 0) {
      const key = token.slice(0, equals);
      const value = stripQuotes(token.slice(equals + 1));
      options[key] = value;
    } else {
      const value = stripQuotes(token);
      if (value) args.push(value);
    }
  }

  return { args, options };
}

function scanOptionTokens(raw: string): string[] {
  const tokens: string[] = [];
  const length = raw.length;
  let index = 0;

  while (index < length) {
    if (/\s/.test(raw[index])) {
      index += 1;
      continue;
    }

    let token = "";
    while (index < length && !/\s/.test(raw[index])) {
      const char = raw[index];
      if (char === '"' || char === "'") {
        const quote = char;
        token += char;
        index += 1;
        while (index < length && raw[index] !== quote) {
          token += raw[index];
          index += 1;
        }
        if (index < length) {
          token += raw[index];
          index += 1;
        }
      } else {
        token += char;
        index += 1;
      }
    }

    if (token) tokens.push(token);
  }

  return tokens;
}

function indexOfUnquotedEquals(token: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
    if (char === '"' && !inSingle) inDouble = !inDouble;
    else if (char === "'" && !inDouble) inSingle = !inSingle;
    else if (char === "=" && !inSingle && !inDouble) return index;
  }
  return -1;
}

function stripQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function splitTableRow(row: string): string[] {
  let value = row.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  return value.split("|").map((cell) => cell.trim());
}

function isListLine(trimmed: string): boolean {
  return /^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed);
}

function canOpenEmphasis(value: string, index: number): boolean {
  const prev = index === 0 ? "" : value[index - 1];
  return !/[A-Za-z0-9_]/.test(prev);
}

function findEmphasisClose(value: string, start: number): number {
  let index = start;
  while (index < value.length) {
    const candidate = value.indexOf("_", index);
    if (candidate < 0) return -1;
    const next = candidate + 1 < value.length ? value[candidate + 1] : "";
    if (!/[A-Za-z0-9_]/.test(next)) return candidate;
    index = candidate + 1;
  }
  return -1;
}

function loc(line: SourceLine): SourceLocation {
  return { line: line.line, column: firstContentColumn(line.text) };
}

function firstContentColumn(value: string): number {
  const match = /\S/.exec(value);
  return match ? match.index + 1 : 1;
}

function diagnosticLength(value: string): number {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.length : 1;
}
