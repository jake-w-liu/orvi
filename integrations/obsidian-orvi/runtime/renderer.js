"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultCss = void 0;
exports.renderOrvi = renderOrvi;
exports.renderToHtml = renderToHtml;
const constants_1 = require("./constants");
const parser_1 = require("./parser");
const styles_1 = require("./styles");
Object.defineProperty(exports, "defaultCss", { enumerable: true, get: function () { return styles_1.defaultCss; } });
const THEME_COLOR_TOKENS = new Set([
    "fg",
    "muted",
    "border",
    "surface",
    "soft",
    "red",
    "blue",
    "green",
    "gray",
    "yellow",
    "purple",
    "orange",
    "pink",
    "cyan"
]);
function renderOrvi(source, options = {}) {
    const ast = (0, parser_1.parseOrvi)(source);
    return {
        ast,
        html: renderToHtml(ast, options)
    };
}
function renderToHtml(ast, options = {}) {
    // Sanitize the id prefix to id-safe characters so it can never break out of
    // an attribute, regardless of what a caller passes.
    const ctx = {
        tabSet: 0,
        idPrefix: (options.idPrefix ?? "").replace(/[^A-Za-z0-9_-]/g, ""),
        sourceLocations: options.sourceLocations === true,
        renderNode: options.renderNode
    };
    const documentClass = ["orvi-document", themeClass(options.colorScheme)].filter(Boolean).join(" ");
    const body = `<main class="${documentClass}">\n${(ast.children ?? []).map((node) => renderBlock(node, ctx)).join("\n")}\n</main>`;
    if (!options.fullDocument) {
        return body;
    }
    const title = escapeHtml(options.title ?? ast.metadata.title ?? options.fallbackTitle ?? "Orvi Document");
    const lang = escapeAttr(options.lang ?? ast.metadata.lang ?? "en");
    const direction = options.dir ?? ast.metadata.dir;
    const dir = isDirection(direction) ? ` dir="${escapeAttr(direction)}"` : "";
    const htmlClass = themeClass(options.colorScheme);
    const htmlClassAttr = htmlClass ? ` class="${htmlClass}"` : "";
    const css = options.includeCss === false
        ? ""
        : `<style>\n${styleText(styles_1.defaultCss, themeCss(options.theme), options.extraCss ?? "")}\n</style>`;
    const reload = options.liveReload ? liveReloadScript() : "";
    return [
        "<!doctype html>",
        `<html lang="${lang}"${dir}${htmlClassAttr}>`,
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        `<title>${title}</title>`,
        css,
        "</head>",
        "<body>",
        body,
        reload,
        "</body>",
        "</html>"
    ]
        .filter(Boolean)
        .join("\n");
}
function renderBlock(node, ctx) {
    if (ctx.renderNode) {
        const custom = ctx.renderNode(node, (inner) => renderBlockDefault(inner, ctx));
        if (typeof custom === "string")
            return custom;
    }
    return renderBlockDefault(node, ctx);
}
function renderBlockDefault(node, ctx) {
    const loc = locAttr(node, ctx);
    switch (node.type) {
        case "heading": {
            const depth = clampHeadingDepth(node.depth);
            return `<h${depth}${loc}>${renderInline(node.children)}</h${depth}>`;
        }
        case "paragraph":
            return `<p${loc}>${renderInline(node.children)}</p>`;
        case "thematicBreak":
            return `<hr class="orvi-hr"${loc}>`;
        case "code":
            return renderCode(node.language, node.filename, node.value, loc);
        case "table":
            return renderTable(node.headers, node.rows, node.aligns, loc);
        case "list":
            return renderList(node.ordered, node.items, loc);
        case "component":
            return renderComponent(node, ctx);
        case "semantic":
            return renderSemantic(node, loc);
        default:
            return "";
    }
}
function locAttr(node, ctx) {
    if (!ctx.sourceLocations || !node.loc || typeof node.loc.line !== "number")
        return "";
    return ` data-orvi-loc="${escapeAttr(`${node.loc.line}:${node.loc.column}`)}"`;
}
function renderCode(language, filename, value, loc = "") {
    const className = language ? ` class="language-${escapeAttr(language)}"` : "";
    const title = filename ? `<div class="orvi-code-title">${escapeHtml(filename)}</div>\n` : "";
    return `${title}<pre class="orvi-code"${loc}><code${className}>${escapeHtml(value)}</code></pre>`;
}
function renderTable(headers, rows, aligns, loc = "") {
    const alignAttr = (column) => {
        const align = (aligns ?? [])[column] ?? "none";
        return align === "none" ? "" : ` class="orvi-align-${align}"`;
    };
    const head = (headers ?? []).map((cell, column) => `<th${alignAttr(column)}>${renderInline(cell)}</th>`).join("");
    const body = (rows ?? [])
        .map((row) => `<tr>${(row ?? []).map((cell, column) => `<td${alignAttr(column)}>${renderInline(cell)}</td>`).join("")}</tr>`)
        .join("");
    return `<table class="orvi-table"${loc}><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
function renderList(ordered, items, loc = "") {
    const tag = ordered ? "ol" : "ul";
    return `<${tag} class="orvi-list"${loc}>${(items ?? []).map((item) => `<li>${renderInline(item)}</li>`).join("")}</${tag}>`;
}
function renderComponent(node, ctx) {
    const options = node.options ?? {};
    const loc = locAttr(node, ctx);
    if (node.name === "callout") {
        // Coerce to a known type at render time so an invalid value (which the
        // parser already flags) can never inject extra class tokens.
        const type = constants_1.CALLOUT_TYPES.has(options.type ?? "") ? options.type : "info";
        const label = `${calloutLabel(type)} callout`;
        return `<aside class="orvi-callout orvi-callout-${type}" role="note" aria-label="${escapeAttr(label)}"${loc}>${renderChildren(node.children, ctx)}</aside>`;
    }
    if (node.name === "card") {
        const bg = constants_1.COLOR_NAMES.has(options.bg ?? "") ? ` orvi-bg-${options.bg}` : "";
        return `<section class="orvi-card${bg}"${loc}>${renderChildren(node.children, ctx)}</section>`;
    }
    if (node.name === "grid") {
        const count = gridCount(node);
        const columns = node.columns ?? [];
        return `<div class="orvi-grid orvi-grid-${count}"${loc}>${columns
            .map((column) => `<div class="orvi-grid-column">${renderChildren(column, ctx)}</div>`)
            .join("")}</div>`;
    }
    if (node.name === "tabs") {
        const tabNodes = (node.children ?? []).filter(isTabNode);
        const group = `${ctx.idPrefix}orvi-tabs-${ctx.tabSet++}`;
        return `<div class="orvi-tabs" role="tablist" aria-label="Tabs"${loc}>${tabNodes
            .map((tab, index) => renderTab(tab, ctx, group, index))
            .join("")}</div>`;
    }
    if (node.name === "tab") {
        const label = options.label ?? "Tab";
        return `<section class="orvi-tab-standalone" aria-label="${escapeAttr(label)}"${loc}>${renderChildren(node.children, ctx)}</section>`;
    }
    return "";
}
function renderTab(node, ctx, group, index) {
    const id = `${group}-${index}`;
    const tabId = `${id}-tab`;
    const panelId = `${id}-panel`;
    const label = (node.options ?? {}).label ?? `Tab ${index + 1}`;
    const checked = index === 0 ? " checked" : "";
    const selected = index === 0 ? "true" : "false";
    return [
        `<input class="orvi-tab-input" type="radio" name="${group}" id="${id}"${checked}>`,
        `<label class="orvi-tab-label" id="${tabId}" role="tab" for="${id}" aria-selected="${selected}" aria-controls="${panelId}">${escapeHtml(label)}</label>`,
        `<div class="orvi-tab-panel" id="${panelId}" role="tabpanel" aria-labelledby="${tabId}"${locAttr(node, ctx)}>${renderChildren(node.children, ctx)}</div>`
    ].join("");
}
function renderSemantic(node, loc = "") {
    if (node.name === "hr")
        return `<hr class="orvi-hr"${loc}>`;
    if (node.name === "br")
        return `<br${loc}>`;
    if (node.name === "btn") {
        return `<a class="orvi-btn" href="${escapeAttr(safeUrl(node.target ?? "#"))}"${loc}>${escapeHtml(node.value ?? "")}</a>`;
    }
    if (node.name === "img") {
        return `<figure class="orvi-image"${loc}><img src="${escapeAttr(safeUrl(node.value ?? ""))}" alt="${escapeAttr(node.alt ?? "")}"></figure>`;
    }
    const requestedType = (node.options ?? {}).type ?? "info";
    const type = constants_1.CALLOUT_TYPES.has(requestedType) ? requestedType : "info";
    return `<span class="orvi-badge orvi-badge-${type}"${loc}>${escapeHtml(node.value ?? "")}</span>`;
}
function renderChildren(children, ctx) {
    return (children ?? []).map((child) => renderBlock(child, ctx)).join("\n");
}
function renderInline(nodes) {
    return (nodes ?? [])
        .map((node) => {
        switch (node.type) {
            case "text":
                return escapeHtml(node.value);
            case "strong":
                return `<strong>${renderInline(node.children)}</strong>`;
            case "emphasis":
                return `<em>${renderInline(node.children)}</em>`;
            case "strike":
                return `<del>${renderInline(node.children)}</del>`;
            case "inlineCode":
                return `<code class="orvi-code-inline">${escapeHtml(node.value)}</code>`;
            case "hardBreak":
                return "<br>";
            case "scope":
                return `<span class="${escapeAttr((node.modifiers ?? []).map(modifierClass).join(" "))}">${renderInline(node.children)}</span>`;
            case "link":
                return `<a class="orvi-link" href="${escapeAttr(safeUrl(node.href ?? "#"))}">${renderInline(node.children)}</a>`;
            default:
                return "";
        }
    })
        .join("");
}
function modifierClass(modifier) {
    if (modifier.kind === "color")
        return `orvi-text-${modifier.value}`;
    if (modifier.kind === "size")
        return `orvi-text-${modifier.value}`;
    if (modifier.kind === "weight")
        return `orvi-font-${modifier.value}`;
    return `orvi-bg-${modifier.value}`;
}
function isTabNode(node) {
    return node.type === "component" && node.name === "tab";
}
function gridCount(node) {
    const declared = Number((node.args ?? [])[0]);
    if (Number.isInteger(declared) && declared >= 1 && declared <= 6)
        return declared;
    return Math.min(Math.max(node.columns?.length ?? 1, 1), 6);
}
function clampHeadingDepth(depth) {
    const n = Math.floor(depth);
    return Number.isInteger(n) && n >= 1 ? Math.min(n, 6) : 1;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
}
function safeUrl(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return "#";
    // eslint-disable-next-line no-control-regex -- intentionally reject control characters in URLs
    if (/[\u0000-\u001f\u007f]/.test(trimmed))
        return "#";
    if (trimmed.startsWith("//"))
        return "#";
    const colonIndex = trimmed.indexOf(":");
    const separatorIndexes = ["/", "?", "#"]
        .map((separator) => trimmed.indexOf(separator))
        .filter((index) => index !== -1);
    const firstSeparator = separatorIndexes.length ? Math.min(...separatorIndexes) : -1;
    if (colonIndex !== -1 && (firstSeparator === -1 || colonIndex < firstSeparator)) {
        const scheme = trimmed.slice(0, colonIndex).replace(/\s+/g, "");
        if (/^(https?|mailto|tel)$/i.test(scheme))
            return trimmed;
        return "#";
    }
    return trimmed;
}
function themeClass(colorScheme) {
    return colorScheme === "dark" ? "orvi-theme-dark" : "";
}
function isDirection(value) {
    return value === "ltr" || value === "rtl" || value === "auto";
}
function calloutLabel(type) {
    if (!type)
        return "Info";
    return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}
function liveReloadScript() {
    return `<script>
(() => {
  const events = new EventSource("/__orvi/events");
  events.addEventListener("message", () => location.reload());
})();
</script>`;
}
function styleText(...blocks) {
    return blocks.filter(Boolean).join("\n").replace(/<\/style/gi, "<\\/style");
}
function themeCss(theme) {
    if (!theme)
        return "";
    const declarations = [];
    for (const [token, value] of Object.entries(theme.colors ?? {})) {
        if (!isThemeColorToken(token))
            continue;
        const safeValue = cssDeclarationValue(value);
        if (safeValue)
            declarations.push(`  --orvi-${token}: ${safeValue};`);
    }
    const radius = cssDeclarationValue(theme.radius);
    const font = cssDeclarationValue(theme.font);
    const maxWidth = cssDeclarationValue(theme.maxWidth);
    if (radius)
        declarations.push(`  --orvi-radius: ${radius};`);
    if (font)
        declarations.push(`  --orvi-font: ${font};`);
    if (maxWidth)
        declarations.push(`  --orvi-max-width: ${maxWidth};`);
    return declarations.length ? `:root {\n${declarations.join("\n")}\n}` : "";
}
function isThemeColorToken(value) {
    return THEME_COLOR_TOKENS.has(value);
}
function cssDeclarationValue(value) {
    if (!value)
        return undefined;
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    // eslint-disable-next-line no-control-regex -- intentionally reject control characters in CSS values
    if (/[\u0000-\u001f\u007f;{}<>]/.test(trimmed))
        return undefined;
    if (/\/\*|\*\//.test(trimmed))
        return undefined;
    return trimmed;
}
