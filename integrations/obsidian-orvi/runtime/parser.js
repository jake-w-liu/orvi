"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrviParser = void 0;
exports.parseOrvi = parseOrvi;
const constants_1 = require("./constants");
const DEFAULT_MAX_NESTING_DEPTH = 8;
// Hard cap on inline-scope/emphasis nesting depth. Beyond this the remainder of
// the run is kept as literal text — this only bounds adversarial inputs (a real
// document never nests inline marks anywhere near this deep) and keeps the
// renderer/formatter from recursing without limit.
const MAX_INLINE_DEPTH = 24;
const DEFAULT_SUPPORTED_VERSION = "0.2";
// Spec versions this parser accepts. 0.2 is a backward-compatible superset of
// 0.1 (it only adds inline constructs), so a document marked `orvi: 0.1` keeps
// validating.
const SUPPORTED_VERSIONS = new Set(["0.1", "0.2"]);
const METADATA_KEYS = new Set(["orvi", "title", "lang", "dir"]);
// Placeholder location for inline-modifier probes that never surface a
// diagnostic (the scope-close scan only needs the boolean validity result).
const ZERO_LOC = { line: 0, column: 0 };
function parseOrvi(source, options = {}) {
    const parser = OrviParser.fromSource(source, options);
    return parser.parseDocument();
}
class OrviParser {
    lines;
    diagnostics;
    index = 0;
    options;
    static fromSource(source, options = {}) {
        const lines = source.replace(/\r\n?/g, "\n").split("\n");
        return new OrviParser(lines.map((text, index) => ({ text, line: index + 1 })), [], normalizeOptions(options));
    }
    constructor(lines, diagnostics, options) {
        this.lines = lines;
        this.diagnostics = diagnostics;
        this.options = options;
    }
    parseDocument() {
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
    parseMetadata() {
        if (!this.isMetadataStart()) {
            return {};
        }
        const start = this.current();
        const hasClose = this.lines.some((line, index) => index > 0 && line.text.trim() === "---");
        this.index += 1;
        const metadata = {};
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
            }
            else if (key === "dir") {
                if (value === "ltr" || value === "rtl" || value === "auto") {
                    metadata.dir = value;
                }
                else {
                    this.error("ORVI_INVALID_METADATA", "dir metadata must be ltr, rtl, or auto.", line);
                }
            }
            else if (key === "orvi") {
                metadata.orvi = value;
            }
            else if (key === "title") {
                metadata.title = value;
            }
            else if (key === "lang") {
                if (/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(value)) {
                    metadata.lang = value;
                }
                else {
                    this.error("ORVI_INVALID_METADATA", "lang metadata must be a valid BCP 47-style tag.", line);
                }
            }
            this.index += 1;
        }
        this.error("ORVI_UNCLOSED_METADATA", "Unclosed metadata block; expected a closing `---`.", start);
        this.validateMetadata(metadata, start);
        return metadata;
    }
    parseBlocks(stopTag, depth = 0) {
        const children = [];
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
            const heading = /^(#{1,6})(\s+(.*))?$/.exec(trimmed);
            if (heading) {
                const content = heading[3] ?? "";
                children.push({
                    type: "heading",
                    loc: loc(line),
                    depth: heading[1].length,
                    children: this.parseInline(content, line.line, line.text.indexOf(content) + 1)
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
    parseComponent(open, line, parent, depth) {
        const { args, options } = tokenizeOptions(open.rawArgs);
        const node = {
            type: "component",
            loc: loc(line),
            name: open.name,
            args,
            options,
            children: []
        };
        this.validateComponentOpen(node, line, parent);
        this.index += 1;
        // Past the nesting limit, report it once and consume the block's body
        // without parsing it — recursing here is what risks a stack overflow on
        // pathologically deep input, and the content is already rejected anyway.
        if (depth >= this.options.maxNestingDepth) {
            this.error("ORVI_MAX_NESTING_DEPTH", `Component nesting exceeds max depth ${this.options.maxNestingDepth}.`, line);
            if (node.name === "grid")
                node.columns = [];
            const closed = this.skipBlockBody(node.name);
            if (!closed) {
                this.error("ORVI_UNCLOSED_BLOCK", `Unclosed [${node.name}] block.`, line);
            }
            return node;
        }
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
    // Consume lines up to the matching close tag for `name` (tracking nested
    // [name]/[/name] pairs and skipping fenced code), discarding the content.
    // Returns whether a matching close was found before end of input.
    skipBlockBody(name) {
        let depth = 1;
        let inFence = false;
        while (!this.isEnd()) {
            const trimmed = this.current().text.trim();
            if (trimmed.startsWith("```")) {
                inFence = !inFence;
                this.index += 1;
                continue;
            }
            if (!inFence) {
                const close = parseCloseTag(trimmed);
                if (close && close.name === name) {
                    depth -= 1;
                    this.index += 1;
                    if (depth === 0)
                        return true;
                    continue;
                }
                const open = parseOpenTag(trimmed);
                if (open && open.name === name) {
                    depth += 1;
                    this.index += 1;
                    continue;
                }
            }
            this.index += 1;
        }
        return false;
    }
    parseGridColumns(openingLine, depth) {
        const sections = [[]];
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
                    }
                    else {
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
    parseNestedLines(lines, depth) {
        const parser = new OrviParser(lines, this.diagnostics, this.options);
        return parser.parseBlocks(undefined, depth).children;
    }
    parseCodeBlock() {
        const opening = this.current();
        const trimmed = opening.text.trim();
        const meta = trimmed.slice(3).trim();
        const [languagePart, filenamePart] = meta.split("|").map((part) => part.trim());
        const languageToken = languagePart ? languagePart.split(/\s+/)[0] : "";
        const language = languageToken && /^[\w.+#-]+$/.test(languageToken) ? languageToken : undefined;
        const filename = filenamePart || undefined;
        const body = [];
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
    parseTable() {
        const start = this.current();
        const headerCells = splitTableRow(start.text);
        const width = headerCells.length;
        const dividerLine = this.lines[this.index + 1]?.text ?? "";
        const aligns = splitTableRow(dividerLine).map(dividerAlignment);
        this.index += 2;
        const rows = [];
        while (!this.isEnd()) {
            const line = this.current();
            const trimmed = line.text.trim();
            if (trimmed === "" || !trimmed.includes("|") || this.isBlockBoundary(line)) {
                break;
            }
            const rowCells = splitTableRow(line.text);
            if (rowCells.length !== width) {
                this.error("ORVI_TABLE_WIDTH_MISMATCH", `Table row has ${rowCells.length} cells but header has ${width}.`, line);
            }
            rows.push(rowCells.map((cell) => this.parseInline(cell, line.line, line.text.indexOf(cell) + 1)));
            this.index += 1;
        }
        return {
            type: "table",
            loc: loc(start),
            headers: headerCells.map((cell) => this.parseInline(cell, start.line, start.text.indexOf(cell) + 1)),
            rows,
            aligns
        };
    }
    parseList() {
        const start = this.current();
        const first = start.text.trim();
        const ordered = /^\d+\./.test(first);
        const items = [];
        while (!this.isEnd()) {
            const line = this.current();
            const trimmed = line.text.trim();
            const match = ordered ? /^\d+\.(\s+(.+))?$/.exec(trimmed) : /^[-*](\s+(.+))?$/.exec(trimmed);
            if (!match) {
                break;
            }
            const content = match[2] ?? "";
            items.push(this.parseInline(content, line.line, line.text.indexOf(content) + 1));
            this.index += 1;
        }
        return {
            type: "list",
            loc: loc(start),
            ordered,
            items
        };
    }
    parseParagraph() {
        const start = this.current();
        const collected = [];
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
        // Join with newlines (not spaces) so the inline scanner can turn a
        // trailing `\` into a hard break and a plain wrap into a soft space.
        const value = collected.map((line) => line.text.trim()).join("\n");
        return {
            type: "paragraph",
            loc: loc(start),
            children: this.parseInline(value, start.line, firstContentColumn(start.text), false)
        };
    }
    parseSemanticLine(line) {
        const match = /^([a-z][a-z0-9-]*):(?:\s*(.*))?$/i.exec(line.text.trim());
        if (!match || !constants_1.SEMANTIC_NAMES.has(match[1])) {
            return undefined;
        }
        this.index += 1;
        const name = match[1];
        const payload = (match[2] ?? "").trim();
        const base = {
            type: "semantic",
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
        if (name === "img") {
            const pipeIndex = payload.indexOf("|");
            const source = pipeIndex < 0 ? payload.trim() : payload.slice(0, pipeIndex).trim();
            const alt = pipeIndex < 0 ? "" : payload.slice(pipeIndex + 1).trim();
            if (pipeIndex < 0 || !source || !alt) {
                this.error("ORVI_INVALID_SEMANTIC", "img: requires `source | alt text`.", line);
            }
            return {
                ...base,
                value: source,
                alt
            };
        }
        // badge: text [| key=value ...] — only the last `|` introduces options, and
        // only when its trailing segment looks like option assignments, so badge
        // text may itself contain `|`.
        const lastPipeIndex = payload.lastIndexOf("|");
        const trailing = lastPipeIndex < 0 ? "" : payload.slice(lastPipeIndex + 1).trim();
        const hasOptions = lastPipeIndex >= 0 && /\S=\S/.test(trailing);
        const text = (hasOptions ? payload.slice(0, lastPipeIndex) : payload).trim();
        const { options } = tokenizeOptions(hasOptions ? trailing : "");
        if (!text) {
            this.error("ORVI_INVALID_SEMANTIC", "badge: requires text.", line);
        }
        if (options.type && !constants_1.CALLOUT_TYPES.has(options.type)) {
            this.error("ORVI_INVALID_OPTION", `Unknown badge type '${options.type}'.`, line);
        }
        return {
            ...base,
            value: text,
            options
        };
    }
    // Single-pass inline scanner. Each iteration either consumes a construct
    // (strong/strike/emphasis/inline-code/scope/link/autolink/escape/break) or
    // extends the pending text run; literal text is flushed lazily. This avoids
    // the per-character re-scans of the previous implementation, and the
    // precomputed scope-close positions plus a scan budget bound adversarial
    // bracket/asterisk inputs to linear time (see __tests__/perf.test.ts).
    parseInline(value, line, column, validateDynamic = true, depth = 0) {
        const nodes = [];
        if (validateDynamic) {
            this.validateDynamicContent(value, line, column);
        }
        const appendText = (text, offset) => {
            if (text.length === 0)
                return;
            const last = nodes[nodes.length - 1];
            if (last && last.type === "text")
                last.value += text;
            else
                nodes.push({ type: "text", loc: { line, column: column + offset }, value: text });
        };
        if (depth >= MAX_INLINE_DEPTH) {
            this.errorAt("ORVI_MAX_NESTING_DEPTH", `Inline nesting exceeds max depth ${MAX_INLINE_DEPTH}.`, line, column);
            appendText(value, 0);
            return nodes;
        }
        let index = 0;
        let textStart = 0;
        const flushText = (end) => {
            if (end > textStart)
                appendText(value.slice(textStart, end), textStart);
        };
        // Perf guards: skip all `[` work when no `]` exists; track whether any `[]`
        // scope-close remains ahead of the cursor (monotonic pointer); cap total
        // scope-close scanning so deeply-nested unclosed input stays linear.
        const hasBracketClose = value.includes("]");
        const scopeClosePositions = allIndexes(value, "[]");
        let scopeClosePtr = 0;
        const scopeCloseAhead = (from) => {
            while (scopeClosePtr < scopeClosePositions.length && scopeClosePositions[scopeClosePtr] < from) {
                scopeClosePtr += 1;
            }
            return scopeClosePtr < scopeClosePositions.length;
        };
        const modMemo = new Map();
        const parseMods = (raw, at) => {
            if (modMemo.has(raw))
                return modMemo.get(raw);
            const parsed = raw.includes("[") ? undefined : this.parseInlineModifiers(raw, at, false);
            modMemo.set(raw, parsed);
            return parsed;
        };
        const scopeScanBudget = { remaining: value.length * 2 + 1000 };
        const findScopeClose = (start) => {
            let scopeDepth = 1;
            let i = start;
            while (i < value.length) {
                if ((scopeScanBudget.remaining -= 1) <= 0)
                    return -1;
                if (value.startsWith("[]", i)) {
                    scopeDepth -= 1;
                    if (scopeDepth === 0)
                        return i;
                    i += 2;
                    continue;
                }
                if (value[i] === "[") {
                    const bracketClose = value.indexOf("]", i + 1);
                    if (bracketClose > i + 1) {
                        const raw = value.slice(i + 1, bracketClose).trim();
                        if (parseMods(raw, ZERO_LOC)) {
                            scopeDepth += 1;
                            i = bracketClose + 1;
                            continue;
                        }
                    }
                }
                i += 1;
            }
            return -1;
        };
        while (index < value.length) {
            const ch = value[index];
            // Backslash: hard line break (before a soft newline), escape of the next
            // punctuation character, or a literal backslash.
            if (ch === "\\") {
                const next = value[index + 1];
                if (next === "\n") {
                    flushText(index);
                    nodes.push({ type: "hardBreak", loc: { line, column: column + index } });
                    index += 2;
                    textStart = index;
                    continue;
                }
                if (next !== undefined && isEscapablePunctuation(next)) {
                    flushText(index);
                    appendText(next, index);
                    index += 2;
                    textStart = index;
                    continue;
                }
                index += 1;
                continue;
            }
            // Soft line break inside a multi-line paragraph renders as a space.
            if (ch === "\n") {
                flushText(index);
                appendText(" ", index);
                index += 1;
                textStart = index;
                continue;
            }
            // Inline code span: `code`. Content is verbatim; a missing close is literal.
            if (ch === "`") {
                const close = value.indexOf("`", index + 1);
                if (close > index) {
                    flushText(index);
                    nodes.push({ type: "inlineCode", loc: { line, column: column + index }, value: value.slice(index + 1, close) });
                    index = close + 1;
                    textStart = index;
                    continue;
                }
                index += 1;
                continue;
            }
            // Strong: **…**
            if (ch === "*" && value[index + 1] === "*") {
                const close = value.indexOf("**", index + 2);
                if (close >= 0) {
                    flushText(index);
                    nodes.push({
                        type: "strong",
                        loc: { line, column: column + index },
                        children: this.parseInline(value.slice(index + 2, close), line, column + index + 2, false, depth + 1)
                    });
                    index = close + 2;
                    textStart = index;
                    continue;
                }
                index += 2;
                continue;
            }
            // Strike: ~~…~~
            if (ch === "~" && value[index + 1] === "~") {
                const close = value.indexOf("~~", index + 2);
                if (close >= 0) {
                    flushText(index);
                    nodes.push({
                        type: "strike",
                        loc: { line, column: column + index },
                        children: this.parseInline(value.slice(index + 2, close), line, column + index + 2, false, depth + 1)
                    });
                    index = close + 2;
                    textStart = index;
                    continue;
                }
                index += 2;
                continue;
            }
            // Emphasis: _…_ or *…* (single marker). `**` is handled above, so a `*`
            // reaching here is a lone marker.
            if ((ch === "_" || ch === "*") && canOpenEmphasis(value, index)) {
                const close = findEmphasisClose(value, index + 1, ch);
                if (close > index + 1) {
                    flushText(index);
                    nodes.push({
                        type: "emphasis",
                        loc: { line, column: column + index },
                        marker: ch,
                        children: this.parseInline(value.slice(index + 1, close), line, column + index + 1, false, depth + 1)
                    });
                    index = close + 1;
                    textStart = index;
                    continue;
                }
                index += 1;
                continue;
            }
            // Inline scope `[mods]…[]` or link `[label](href)`.
            if (ch === "[" && hasBracketClose && !value.startsWith("[]", index)) {
                const bracketClose = value.indexOf("]", index + 1);
                if (bracketClose > index + 1) {
                    const rawModifiers = value.slice(index + 1, bracketClose).trim();
                    const modifiers = parseMods(rawModifiers, { line, column: column + index + 1 });
                    if (modifiers) {
                        const closeAhead = scopeCloseAhead(index);
                        const scopeClose = closeAhead ? findScopeClose(bracketClose + 1) : -1;
                        if (scopeClose >= 0) {
                            flushText(index);
                            nodes.push({
                                type: "scope",
                                loc: { line, column: column + index },
                                modifiers,
                                children: this.parseInline(value.slice(bracketClose + 1, scopeClose), line, column + bracketClose + 1, false, depth + 1)
                            });
                            index = scopeClose + 2;
                            textStart = index;
                            continue;
                        }
                        this.errorAt("ORVI_UNCLOSED_SCOPE", "Unclosed inline scope; expected [].", line, column + index);
                        index += 1;
                        continue;
                    }
                    // `[label](href)` is an inline link when the bracket content is not a
                    // valid modifier list (so it can never shadow an `[mods]…[]` scope)
                    // and the label and href are both non-empty (an empty label would
                    // format back to `[]`, the scope-close sentinel, and not round-trip).
                    if (rawModifiers.length > 0 && value[bracketClose + 1] === "(") {
                        const parenClose = value.indexOf(")", bracketClose + 2);
                        if (parenClose > bracketClose + 1) {
                            const href = value.slice(bracketClose + 2, parenClose).trim();
                            if (href.length > 0) {
                                flushText(index);
                                nodes.push({
                                    type: "link",
                                    loc: { line, column: column + index },
                                    href,
                                    children: this.parseInline(rawModifiers, line, column + index + 1, false, depth + 1)
                                });
                                index = parenClose + 1;
                                textStart = index;
                                continue;
                            }
                        }
                    }
                    // Looked like an attempted scope (a `[]` close exists ahead) but the
                    // modifiers are invalid — report it.
                    if (scopeCloseAhead(index)) {
                        this.parseInlineModifiers(rawModifiers, { line, column: column + index + 1 }, true);
                    }
                    index += 1;
                    continue;
                }
                index += 1;
                continue;
            }
            // Bare autolink: http(s)://… written directly in the text.
            if ((ch === "h" || ch === "H") && canStartAutolink(value, index)) {
                const url = matchAutolink(value, index);
                if (url) {
                    flushText(index);
                    nodes.push({
                        type: "link",
                        loc: { line, column: column + index },
                        href: url,
                        auto: true,
                        children: [{ type: "text", loc: { line, column: column + index }, value: url }]
                    });
                    index += url.length;
                    textStart = index;
                    continue;
                }
            }
            index += 1;
        }
        flushText(index);
        return nodes;
    }
    parseInlineModifiers(raw, loc, report) {
        const tokens = raw.split(/\s+/).filter(Boolean);
        if (tokens.length === 0) {
            if (report)
                this.errorAt("ORVI_INVALID_MODIFIER", "Inline scope requires at least one modifier.", loc.line, loc.column);
            return undefined;
        }
        const modifiers = [];
        for (const token of tokens) {
            if (constants_1.COLOR_NAMES.has(token)) {
                modifiers.push({ kind: "color", value: token });
            }
            else if (constants_1.SIZE_NAMES.has(token)) {
                modifiers.push({ kind: "size", value: token });
            }
            else if (constants_1.WEIGHT_NAMES.has(token)) {
                modifiers.push({ kind: "weight", value: token });
            }
            else if (token.startsWith("bg=") && constants_1.COLOR_NAMES.has(token.slice(3))) {
                modifiers.push({ kind: "background", value: token.slice(3) });
            }
            else {
                if (report)
                    this.errorAt("ORVI_INVALID_MODIFIER", `Unknown inline modifier '${token}'.`, loc.line, loc.column);
                return undefined;
            }
        }
        return modifiers;
    }
    validateComponentOpen(node, line, parent) {
        this.validateComponentArguments(node, line);
        this.validateComponentOptions(node, line);
        if (node.name === "callout" && node.options.type && !constants_1.CALLOUT_TYPES.has(node.options.type)) {
            this.error("ORVI_INVALID_OPTION", `Unknown callout type '${node.options.type}'.`, line);
        }
        if (node.name === "grid") {
            const count = Number(node.args[0]);
            if (!Number.isInteger(count) || count < 1 || count > 6 || node.args.length !== 1) {
                this.error("ORVI_INVALID_GRID", "grid requires one column count from 1 to 6.", line);
            }
        }
        if (node.name === "card" && node.options.bg && !constants_1.COLOR_NAMES.has(node.options.bg)) {
            this.error("ORVI_INVALID_OPTION", `Unknown card background '${node.options.bg}'.`, line);
        }
        if (node.name === "tab" && !node.options.label) {
            this.error("ORVI_INVALID_TAB", "tab requires label=<text>.", line);
        }
        if (node.name === "tab" && parent !== "tabs") {
            this.error("ORVI_INVALID_TAB", "tab blocks must be direct children of [tabs].", line);
        }
    }
    validateComponentChildren(node, line) {
        if (node.name !== "tabs")
            return;
        const tabChildren = node.children.filter((child) => child.type === "component" && child.name === "tab");
        if (tabChildren.length === 0) {
            this.error("ORVI_INVALID_TABS", "tabs requires at least one [tab] child.", line);
        }
        for (const child of node.children) {
            if (child.type !== "component" || child.name !== "tab") {
                this.errorAt("ORVI_INVALID_TABS_CHILD", "Only [tab] blocks may be direct children of [tabs].", child.loc.line, child.loc.column);
            }
        }
    }
    validateComponentArguments(node, line) {
        if (node.name === "grid")
            return;
        if (node.args.length > 0) {
            this.error("ORVI_UNEXPECTED_ARGUMENT", `[${node.name}] does not accept positional arguments.`, line);
        }
    }
    validateComponentOptions(node, line) {
        const allowedOptions = {
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
    validateGridShape(node, line) {
        const declared = Number(node.args[0]);
        if (Number.isInteger(declared) && node.columns && node.columns.length !== declared) {
            this.error("ORVI_GRID_MISMATCH", `grid declared ${declared} columns but found ${node.columns.length}.`, line);
        }
    }
    validateMetadata(metadata, line) {
        if (!metadata.orvi)
            return;
        if (metadata.orvi !== this.options.supportedVersion && !SUPPORTED_VERSIONS.has(metadata.orvi)) {
            this.error("ORVI_UNSUPPORTED_VERSION", `Unsupported Orvi version '${metadata.orvi}'; expected '${this.options.supportedVersion}'.`, line);
        }
    }
    validateDynamicContent(value, line, column) {
        const dynamicPattern = /\{[A-Za-z_][A-Za-z0-9_.-]*\}/g;
        for (const match of value.matchAll(dynamicPattern)) {
            this.errorAt("ORVI_DYNAMIC_CONTENT_UNSUPPORTED", "Dynamic expressions are not supported in Orvi v0.1.", line, column + (match.index ?? 0), match[0].length);
        }
    }
    isTableStart() {
        if (this.index + 1 >= this.lines.length)
            return false;
        return looksLikeTable(this.current().text, this.lines[this.index + 1].text);
    }
    isBlockBoundary(line) {
        const trimmed = line.text.trim();
        if (trimmed === "" || trimmed.startsWith("//"))
            return true;
        if (trimmed.startsWith("```"))
            return true;
        if (parseCloseTag(trimmed) || parseOpenTag(trimmed))
            return true;
        if (/^(#{1,6})(\s+(.*))?$/.test(trimmed))
            return true;
        if (trimmed === "---")
            return true;
        if (isListLine(trimmed))
            return true;
        if (/^([a-z][a-z0-9-]*):(?:\s*(.*))?$/i.test(trimmed) && constants_1.SEMANTIC_NAMES.has(trimmed.split(":")[0]))
            return true;
        // A table that begins on the next line ends the current block (so a
        // paragraph immediately before a table is not absorbed into it).
        const next = this.lines[this.index + 1];
        if (next && looksLikeTable(line.text, next.text))
            return true;
        return false;
    }
    current() {
        return this.lines[this.index];
    }
    isEnd() {
        return this.index >= this.lines.length;
    }
    isMetadataStart() {
        if (this.index !== 0 || this.lines.length < 2)
            return false;
        if (this.lines[0].text.trim() !== "---")
            return false;
        const entryPattern = /^([a-z][a-z0-9-]*):\s*(.*)$/i;
        const closeIndex = this.lines.findIndex((line, index) => index > 0 && line.text.trim() === "---");
        if (closeIndex >= 0) {
            return this.lines.slice(1, closeIndex).some((line) => entryPattern.test(line.text.trim()));
        }
        // No closing `---`: still treat this as a metadata block when the first line already looks
        // like an entry, so the author gets an ORVI_UNCLOSED_METADATA diagnostic instead of silence.
        return entryPattern.test((this.lines[1]?.text ?? "").trim());
    }
    error(code, message, line) {
        this.errorAt(code, message, line.line, firstContentColumn(line.text), diagnosticLength(line.text));
    }
    warning(code, message, line) {
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
    errorAt(code, message, line, column, length = 1) {
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
exports.OrviParser = OrviParser;
function normalizeOptions(options) {
    const requested = options.maxNestingDepth;
    const maxNestingDepth = typeof requested === "number" && Number.isFinite(requested) && requested >= 0
        ? Math.floor(requested)
        : DEFAULT_MAX_NESTING_DEPTH;
    return {
        maxNestingDepth,
        supportedVersion: options.supportedVersion ?? DEFAULT_SUPPORTED_VERSION
    };
}
function parseOpenTag(trimmed) {
    const match = /^\[([a-z][a-z0-9-]*)(?:\s+([^\]]+))?\]$/i.exec(trimmed);
    if (!match)
        return undefined;
    return {
        name: match[1],
        rawArgs: match[2] ?? ""
    };
}
function isComponentName(name) {
    return constants_1.COMPONENT_NAMES.has(name);
}
function parseCloseTag(trimmed) {
    const match = /^\[\/([a-z][a-z0-9-]*)\]$/i.exec(trimmed);
    if (!match)
        return undefined;
    return { name: match[1] };
}
function tokenizeOptions(raw) {
    const args = [];
    const options = {};
    const tokens = scanOptionTokens(raw);
    for (const token of tokens) {
        const equals = indexOfUnquotedEquals(token);
        if (equals > 0) {
            const key = token.slice(0, equals);
            const value = stripQuotes(token.slice(equals + 1));
            options[key] = value;
        }
        else {
            const value = stripQuotes(token);
            if (value)
                args.push(value);
        }
    }
    return { args, options };
}
function scanOptionTokens(raw) {
    const tokens = [];
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
            }
            else {
                token += char;
                index += 1;
            }
        }
        if (token)
            tokens.push(token);
    }
    return tokens;
}
function indexOfUnquotedEquals(token) {
    let inSingle = false;
    let inDouble = false;
    for (let index = 0; index < token.length; index += 1) {
        const char = token[index];
        if (char === '"' && !inSingle)
            inDouble = !inDouble;
        else if (char === "'" && !inDouble)
            inSingle = !inSingle;
        else if (char === "=" && !inSingle && !inDouble)
            return index;
    }
    return -1;
}
function stripQuotes(value) {
    if (value.length >= 2) {
        const first = value[0];
        const last = value[value.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
            return value.slice(1, -1);
        }
    }
    return value;
}
function splitTableRow(row) {
    let value = row.trim();
    if (value.startsWith("|"))
        value = value.slice(1);
    if (value.endsWith("|"))
        value = value.slice(0, -1);
    return value.split("|").map((cell) => cell.trim());
}
function isDividerCell(cell) {
    return /^:?-{3,}:?$/.test(cell.trim());
}
function dividerAlignment(cell) {
    const trimmed = cell.trim();
    const left = trimmed.startsWith(":");
    const right = trimmed.endsWith(":");
    if (left && right)
        return "center";
    if (right)
        return "right";
    if (left)
        return "left";
    return "none";
}
// A header line followed by a divider line is a table only when BOTH lines
// carry a pipe (so a single-cell `| Note |` over a bare `---` stays a paragraph
// plus a thematic break) and every divider cell is `:?---:?`.
function looksLikeTable(headerLine, dividerLine) {
    const header = headerLine.trim();
    const divider = dividerLine.trim();
    if (!header.includes("|") || !divider.includes("|"))
        return false;
    const headerCells = splitTableRow(header);
    const dividerCells = splitTableRow(divider);
    return headerCells.length >= 1 && headerCells.length === dividerCells.length && dividerCells.every(isDividerCell);
}
function isListLine(trimmed) {
    // A bullet/number marker, either alone (an empty item) or followed by content.
    return /^[-*](\s+(.+))?$/.test(trimmed) || /^\d+\.(\s+(.+))?$/.test(trimmed);
}
// An emphasis run opens only when it is not intra-word (no preceding word
// character) and is left-flanking (immediately followed by a non-space), so
// `a _ b _ c` and `2 * 3 * 4` stay literal.
function canOpenEmphasis(value, index) {
    const prev = index === 0 ? "" : value[index - 1];
    const next = index + 1 < value.length ? value[index + 1] : "";
    return !/[A-Za-z0-9_]/.test(prev) && next !== "" && !/\s/.test(next);
}
// The close must be right-flanking (preceded by a non-space) and not land
// inside a word (next char is not a word character).
function findEmphasisClose(value, start, marker) {
    let index = start;
    while (index < value.length) {
        const candidate = value.indexOf(marker, index);
        if (candidate < 0)
            return -1;
        const prev = candidate > 0 ? value[candidate - 1] : "";
        const next = candidate + 1 < value.length ? value[candidate + 1] : "";
        if (prev !== "" && !/\s/.test(prev) && !/[A-Za-z0-9_]/.test(next))
            return candidate;
        index = candidate + 1;
    }
    return -1;
}
// CommonMark's escapable set: any ASCII punctuation character. A backslash
// before one of these yields the literal character; before anything else the
// backslash stays literal.
function isEscapablePunctuation(ch) {
    return /^[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]$/.test(ch);
}
function allIndexes(value, needle) {
    const out = [];
    let index = value.indexOf(needle);
    while (index >= 0) {
        out.push(index);
        index = value.indexOf(needle, index + needle.length);
    }
    return out;
}
// A bare autolink may start only at a word boundary and only with an http(s)
// scheme (mailto/tel/bare-domain/email autolinking is intentionally excluded).
function canStartAutolink(value, index) {
    const prev = index === 0 ? "" : value[index - 1];
    if (/[A-Za-z0-9]/.test(prev))
        return false;
    const head = value.slice(index, index + 8).toLowerCase();
    return head.startsWith("http://") || head.startsWith("https://");
}
function matchAutolink(value, index) {
    const match = /^https?:\/\/[^\s<>"`]+/i.exec(value.slice(index));
    if (!match)
        return "";
    let url = match[0];
    // Trailing punctuation is usually sentence punctuation, not part of the URL.
    // A trailing `)` is kept only when it balances a `(` inside the URL.
    while (url.length > 0 && /[.,;:!?'")\]]/.test(url[url.length - 1])) {
        if (url[url.length - 1] === ")") {
            const opens = (url.match(/\(/g) ?? []).length;
            const closes = (url.match(/\)/g) ?? []).length;
            if (closes <= opens)
                break;
        }
        url = url.slice(0, -1);
    }
    const schemeEnd = url.indexOf("://");
    return schemeEnd >= 0 && url.length > schemeEnd + 3 ? url : "";
}
function loc(line) {
    return { line: line.line, column: firstContentColumn(line.text) };
}
function firstContentColumn(value) {
    const match = /\S/.exec(value);
    return match ? match.index + 1 : 1;
}
function diagnosticLength(value) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.length : 1;
}
