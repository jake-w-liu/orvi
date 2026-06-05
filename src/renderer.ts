import {
  BaseNode,
  BlockNode,
  ColumnAlignment,
  ComponentNode,
  DocumentNode,
  InlineModifier,
  InlineNode,
  ListItemNode,
  ListNode,
  SemanticNode
} from "./ast";
import { CALLOUT_TYPES, COLOR_NAMES } from "./constants";
import { parseOrvi } from "./parser";
import { defaultCss } from "./styles";

/**
 * Override the rendered HTML for a block-level node. Return a string to use it
 * verbatim, or `undefined` to fall back to the default. `defaultRender(node)`
 * renders a node the built-in way (no further hook re-entry), so a hook can
 * wrap or post-process the default output.
 */
export type RenderNodeHook = (
  node: BlockNode,
  defaultRender: (node: BlockNode) => string
) => string | undefined;

export interface RenderOptions {
  fullDocument?: boolean;
  includeCss?: boolean;
  title?: string;
  fallbackTitle?: string;
  lang?: string;
  dir?: OrviDirection;
  liveReload?: boolean;
  colorScheme?: OrviColorScheme;
  theme?: OrviTheme;
  extraCss?: string;
  /**
   * Prefix for generated element ids and form-control names (currently the
   * `[tabs]` radio groups). Set this per render when multiple Orvi fragments
   * share one HTML page so their tab groups do not collide. Defaults to "".
   */
  idPrefix?: string;
  /**
   * When true, every block-level element carries a `data-orvi-loc="line:column"`
   * attribute pointing at its source position. Useful for editor integrations
   * (click-to-source / scroll sync). Off by default.
   */
  sourceLocations?: boolean;
  /**
   * Optional override for the HTML of block-level nodes. Orvi has no plugin API
   * by design — this hook plus walking the AST from `parseOrvi` are the
   * extension points (see `docs/stability.md`).
   */
  renderNode?: RenderNodeHook;
}

export interface RenderResult {
  html: string;
  ast: DocumentNode;
}

export interface OrviTheme {
  colors?: Partial<Record<ThemeColorToken, string>>;
  radius?: string;
  font?: string;
  maxWidth?: string;
}

export type OrviColorScheme = "light" | "dark";
export type OrviDirection = "ltr" | "rtl" | "auto";

export type ThemeColorToken =
  | "fg"
  | "muted"
  | "border"
  | "surface"
  | "soft"
  | "red"
  | "blue"
  | "green"
  | "gray"
  | "yellow"
  | "purple"
  | "orange"
  | "pink"
  | "cyan";

const THEME_COLOR_TOKENS = new Set<ThemeColorToken>([
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

interface RenderContext {
  tabSet: number;
  idPrefix: string;
  sourceLocations: boolean;
  renderNode?: RenderNodeHook;
}

export function renderOrvi(source: string, options: RenderOptions = {}): RenderResult {
  const ast = parseOrvi(source);
  return {
    ast,
    html: renderToHtml(ast, options)
  };
}

export function renderToHtml(ast: DocumentNode, options: RenderOptions = {}): string {
  // Sanitize the id prefix to id-safe characters so it can never break out of
  // an attribute, regardless of what a caller passes.
  const ctx: RenderContext = {
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
  const css =
    options.includeCss === false
      ? ""
      : `<style>\n${styleText(defaultCss, themeCss(options.theme), options.extraCss ?? "")}\n</style>`;
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

export { defaultCss };

function renderBlock(node: BlockNode, ctx: RenderContext): string {
  if (ctx.renderNode) {
    const custom = ctx.renderNode(node, (inner) => renderBlockDefault(inner, ctx));
    if (typeof custom === "string") return custom;
  }
  return renderBlockDefault(node, ctx);
}

function renderBlockDefault(node: BlockNode, ctx: RenderContext): string {
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
      return renderList(node, ctx, loc);
    case "blockquote":
      return `<blockquote class="orvi-quote"${loc}>${renderChildren(node.children, ctx)}</blockquote>`;
    case "component":
      return renderComponent(node, ctx);
    case "semantic":
      return renderSemantic(node, loc);
    default:
      return "";
  }
}

function locAttr(node: BaseNode, ctx: RenderContext): string {
  if (!ctx.sourceLocations || !node.loc || typeof node.loc.line !== "number") return "";
  return ` data-orvi-loc="${escapeAttr(`${node.loc.line}:${node.loc.column}`)}"`;
}

function renderCode(language: string | undefined, filename: string | undefined, value: string, loc = ""): string {
  const className = language ? ` class="language-${escapeAttr(language)}"` : "";
  const title = filename ? `<div class="orvi-code-title">${escapeHtml(filename)}</div>\n` : "";
  return `${title}<pre class="orvi-code"${loc}><code${className}>${escapeHtml(value)}</code></pre>`;
}

function renderTable(headers: InlineNode[][], rows: InlineNode[][][], aligns: ColumnAlignment[] | undefined, loc = ""): string {
  const alignAttr = (column: number): string => {
    const align = (aligns ?? [])[column] ?? "none";
    return align === "none" ? "" : ` class="orvi-align-${align}"`;
  };
  const head = (headers ?? []).map((cell, column) => `<th${alignAttr(column)}>${renderInline(cell)}</th>`).join("");
  const body = (rows ?? [])
    .map((row) => `<tr>${(row ?? []).map((cell, column) => `<td${alignAttr(column)}>${renderInline(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="orvi-table"${loc}><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderList(node: ListNode, ctx: RenderContext, loc = ""): string {
  const tag = node.ordered ? "ol" : "ul";
  const items = node.items ?? [];
  const hasTask = items.some((item) => item.task !== undefined);
  const className = `orvi-list${hasTask ? " orvi-task-list" : ""}`;
  const start = node.ordered && node.start && node.start > 1 ? ` start="${node.start}"` : "";
  const body = items.map((item) => renderListItem(item, ctx, node.loose === true)).join("");
  return `<${tag} class="${className}"${start}${loc}>${body}</${tag}>`;
}

function renderListItem(item: ListItemNode, ctx: RenderContext, loose: boolean): string {
  const liClass = item.task !== undefined ? ` class="orvi-task"` : "";
  const checkbox =
    item.task !== undefined
      ? `<input class="orvi-task-box" type="checkbox" disabled${item.task ? " checked" : ""} aria-label="${
          item.task ? "Completed" : "To do"
        }"> `
      : "";
  // In a tight list a single-paragraph item renders its inline content directly
  // (no <p>), matching plain Markdown; a loose list keeps the <p> wrappers.
  const inner = (item.children ?? [])
    .map((child) => (!loose && child.type === "paragraph" ? renderInline(child.children) : renderBlock(child, ctx)))
    .join("\n");
  return `<li${liClass}>${checkbox}${inner}</li>`;
}

function renderComponent(node: ComponentNode, ctx: RenderContext): string {
  const options = node.options ?? {};
  const loc = locAttr(node, ctx);
  if (node.name === "callout") {
    // Coerce to a known type at render time so an invalid value (which the
    // parser already flags) can never inject extra class tokens.
    const type = CALLOUT_TYPES.has(options.type ?? "") ? options.type! : "info";
    const label = `${calloutLabel(type)} callout`;
    return `<aside class="orvi-callout orvi-callout-${type}" role="note" aria-label="${escapeAttr(
      label
    )}"${loc}>${renderChildren(node.children, ctx)}</aside>`;
  }

  if (node.name === "card") {
    const bg = COLOR_NAMES.has(options.bg ?? "") ? ` orvi-bg-${options.bg}` : "";
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

function renderTab(node: ComponentNode, ctx: RenderContext, group: string, index: number): string {
  const id = `${group}-${index}`;
  const tabId = `${id}-tab`;
  const panelId = `${id}-panel`;
  const label = (node.options ?? {}).label ?? `Tab ${index + 1}`;
  const checked = index === 0 ? " checked" : "";
  const selected = index === 0 ? "true" : "false";
  return [
    `<input class="orvi-tab-input" type="radio" name="${group}" id="${id}"${checked}>`,
    `<label class="orvi-tab-label" id="${tabId}" role="tab" for="${id}" aria-selected="${selected}" aria-controls="${panelId}">${escapeHtml(
      label
    )}</label>`,
    `<div class="orvi-tab-panel" id="${panelId}" role="tabpanel" aria-labelledby="${tabId}"${locAttr(node, ctx)}>${renderChildren(
      node.children,
      ctx
    )}</div>`
  ].join("");
}

function renderSemantic(node: SemanticNode, loc = ""): string {
  if (node.name === "hr") return `<hr class="orvi-hr"${loc}>`;
  if (node.name === "br") return `<br${loc}>`;

  if (node.name === "btn") {
    return `<a class="orvi-btn" href="${escapeAttr(safeUrl(node.target ?? "#"))}"${loc}>${escapeHtml(node.value ?? "")}</a>`;
  }

  if (node.name === "img") {
    return `<figure class="orvi-image"${loc}><img src="${escapeAttr(safeUrl(node.value ?? ""))}" alt="${escapeAttr(
      node.alt ?? ""
    )}"></figure>`;
  }

  const requestedType = (node.options ?? {}).type ?? "info";
  const type = CALLOUT_TYPES.has(requestedType) ? requestedType : "info";
  return `<span class="orvi-badge orvi-badge-${type}"${loc}>${escapeHtml(node.value ?? "")}</span>`;
}

function renderChildren(children: BlockNode[], ctx: RenderContext): string {
  return (children ?? []).map((child) => renderBlock(child, ctx)).join("\n");
}

function renderInline(nodes: InlineNode[]): string {
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

function modifierClass(modifier: InlineModifier): string {
  if (modifier.kind === "color") return `orvi-text-${modifier.value}`;
  if (modifier.kind === "size") return `orvi-text-${modifier.value}`;
  if (modifier.kind === "weight") return `orvi-font-${modifier.value}`;
  return `orvi-bg-${modifier.value}`;
}

function isTabNode(node: BlockNode): node is ComponentNode {
  return node.type === "component" && node.name === "tab";
}

function gridCount(node: ComponentNode): number {
  const declared = Number((node.args ?? [])[0]);
  if (Number.isInteger(declared) && declared >= 1 && declared <= 6) return declared;
  return Math.min(Math.max(node.columns?.length ?? 1, 1), 6);
}

function clampHeadingDepth(depth: number): number {
  const n = Math.floor(depth);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, 6) : 1;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function safeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "#";
  // eslint-disable-next-line no-control-regex -- intentionally reject control characters in URLs
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return "#";
  if (trimmed.startsWith("//")) return "#";

  const colonIndex = trimmed.indexOf(":");
  const separatorIndexes = ["/", "?", "#"]
    .map((separator) => trimmed.indexOf(separator))
    .filter((index) => index !== -1);
  const firstSeparator = separatorIndexes.length ? Math.min(...separatorIndexes) : -1;
  if (colonIndex !== -1 && (firstSeparator === -1 || colonIndex < firstSeparator)) {
    const scheme = trimmed.slice(0, colonIndex).replace(/\s+/g, "");
    if (/^(https?|mailto|tel)$/i.test(scheme)) return trimmed;
    return "#";
  }

  return trimmed;
}

function themeClass(colorScheme: OrviColorScheme | undefined): string {
  return colorScheme === "dark" ? "orvi-theme-dark" : "";
}

function isDirection(value: string | undefined): value is OrviDirection {
  return value === "ltr" || value === "rtl" || value === "auto";
}

function calloutLabel(type: string): string {
  if (!type) return "Info";
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

function liveReloadScript(): string {
  return `<script>
(() => {
  const events = new EventSource("/__orvi/events");
  events.addEventListener("message", () => location.reload());
})();
</script>`;
}

function styleText(...blocks: string[]): string {
  return blocks.filter(Boolean).join("\n").replace(/<\/style/gi, "<\\/style");
}

function themeCss(theme: OrviTheme | undefined): string {
  if (!theme) return "";
  const declarations: string[] = [];

  for (const [token, value] of Object.entries(theme.colors ?? {})) {
    if (!isThemeColorToken(token)) continue;
    const safeValue = cssDeclarationValue(value);
    if (safeValue) declarations.push(`  --orvi-${token}: ${safeValue};`);
  }

  const radius = cssDeclarationValue(theme.radius);
  const font = cssDeclarationValue(theme.font);
  const maxWidth = cssDeclarationValue(theme.maxWidth);
  if (radius) declarations.push(`  --orvi-radius: ${radius};`);
  if (font) declarations.push(`  --orvi-font: ${font};`);
  if (maxWidth) declarations.push(`  --orvi-max-width: ${maxWidth};`);

  return declarations.length ? `:root {\n${declarations.join("\n")}\n}` : "";
}

function isThemeColorToken(value: string): value is ThemeColorToken {
  return THEME_COLOR_TOKENS.has(value as ThemeColorToken);
}

function cssDeclarationValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // eslint-disable-next-line no-control-regex -- intentionally reject control characters in CSS values
  if (/[\u0000-\u001f\u007f;{}<>]/.test(trimmed)) return undefined;
  if (/\/\*|\*\//.test(trimmed)) return undefined;
  return trimmed;
}
