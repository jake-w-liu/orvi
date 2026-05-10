import {
  BlockNode,
  ComponentNode,
  DocumentNode,
  InlineModifier,
  InlineNode,
  SemanticNode
} from "./ast";
import { parseLux } from "./parser";
import { defaultCss } from "./styles";

export interface RenderOptions {
  fullDocument?: boolean;
  includeCss?: boolean;
  title?: string;
  liveReload?: boolean;
  theme?: LuxTheme;
  extraCss?: string;
}

export interface RenderResult {
  html: string;
  ast: DocumentNode;
}

export interface LuxTheme {
  colors?: Partial<Record<ThemeColorToken, string>>;
  radius?: string;
  font?: string;
  maxWidth?: string;
}

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

interface RenderContext {
  tabSet: number;
}

export function renderLux(source: string, options: RenderOptions = {}): RenderResult {
  const ast = parseLux(source);
  return {
    ast,
    html: renderToHtml(ast, options)
  };
}

export function renderToHtml(ast: DocumentNode, options: RenderOptions = {}): string {
  const ctx: RenderContext = { tabSet: 0 };
  const body = `<main class="lux-document">\n${ast.children.map((node) => renderBlock(node, ctx)).join("\n")}\n</main>`;
  if (!options.fullDocument) {
    return body;
  }

  const title = escapeHtml(options.title ?? "Lux Document");
  const css =
    options.includeCss === false
      ? ""
      : `<style>\n${defaultCss}\n${themeCss(options.theme)}\n${options.extraCss ?? ""}\n</style>`;
  const reload = options.liveReload ? liveReloadScript() : "";
  return [
    "<!doctype html>",
    '<html lang="en">',
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
  switch (node.type) {
    case "heading":
      return `<h${node.depth}>${renderInline(node.children)}</h${node.depth}>`;
    case "paragraph":
      return `<p>${renderInline(node.children)}</p>`;
    case "thematicBreak":
      return '<hr class="lux-hr">';
    case "code":
      return renderCode(node.language, node.filename, node.value);
    case "table":
      return renderTable(node.headers, node.rows);
    case "list":
      return renderList(node.ordered, node.items);
    case "component":
      return renderComponent(node, ctx);
    case "semantic":
      return renderSemantic(node);
    default:
      return "";
  }
}

function renderCode(language: string | undefined, filename: string | undefined, value: string): string {
  const className = language ? ` class="language-${escapeAttr(language)}"` : "";
  const title = filename ? `<div class="lux-code-title">${escapeHtml(filename)}</div>\n` : "";
  return `${title}<pre class="lux-code"><code${className}>${escapeHtml(value)}</code></pre>`;
}

function renderTable(headers: InlineNode[][], rows: InlineNode[][][]): string {
  const head = headers.map((cell) => `<th>${renderInline(cell)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="lux-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderList(ordered: boolean, items: InlineNode[][]): string {
  const tag = ordered ? "ol" : "ul";
  return `<${tag} class="lux-list">${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${tag}>`;
}

function renderComponent(node: ComponentNode, ctx: RenderContext): string {
  if (node.name === "callout") {
    const type = node.options.type ?? "info";
    return `<aside class="lux-callout lux-callout-${escapeAttr(type)}">${renderChildren(node.children, ctx)}</aside>`;
  }

  if (node.name === "card") {
    const bg = node.options.bg ? ` lux-bg-${escapeAttr(node.options.bg)}` : "";
    return `<section class="lux-card${bg}">${renderChildren(node.children, ctx)}</section>`;
  }

  if (node.name === "grid") {
    const count = gridCount(node);
    const columns = node.columns ?? [];
    return `<div class="lux-grid lux-grid-${count}">${columns
      .map((column) => `<div class="lux-grid-column">${renderChildren(column, ctx)}</div>`)
      .join("")}</div>`;
  }

  if (node.name === "tabs") {
    const tabNodes = node.children.filter(isTabNode);
    const group = `lux-tabs-${ctx.tabSet++}`;
    return `<div class="lux-tabs">${tabNodes
      .map((tab, index) => renderTab(tab, ctx, group, index))
      .join("")}</div>`;
  }

  if (node.name === "tab") {
    const label = node.options.label ?? "Tab";
    return `<section class="lux-tab-standalone" aria-label="${escapeAttr(label)}">${renderChildren(node.children, ctx)}</section>`;
  }

  return "";
}

function renderTab(node: ComponentNode, ctx: RenderContext, group: string, index: number): string {
  const id = `${group}-${index}`;
  const label = node.options.label ?? `Tab ${index + 1}`;
  const checked = index === 0 ? " checked" : "";
  return [
    `<input class="lux-tab-input" type="radio" name="${group}" id="${id}"${checked}>`,
    `<label class="lux-tab-label" for="${id}">${escapeHtml(label)}</label>`,
    `<div class="lux-tab-panel">${renderChildren(node.children, ctx)}</div>`
  ].join("");
}

function renderSemantic(node: SemanticNode): string {
  if (node.name === "hr") return '<hr class="lux-hr">';
  if (node.name === "br") return "<br>";

  if (node.name === "btn") {
    return `<a class="lux-btn" href="${escapeAttr(safeUrl(node.target ?? "#"))}">${escapeHtml(node.value ?? "")}</a>`;
  }

  if (node.name === "img") {
    return `<figure class="lux-image"><img src="${escapeAttr(safeUrl(node.value ?? ""))}" alt="${escapeAttr(
      node.alt ?? ""
    )}"></figure>`;
  }

  const type = node.options.type ?? "info";
  return `<span class="lux-badge lux-badge-${escapeAttr(type)}">${escapeHtml(node.value ?? "")}</span>`;
}

function renderChildren(children: BlockNode[], ctx: RenderContext): string {
  return children.map((child) => renderBlock(child, ctx)).join("\n");
}

function renderInline(nodes: InlineNode[]): string {
  return nodes
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
        case "scope":
          return `<span class="${node.modifiers.map(modifierClass).join(" ")}">${renderInline(node.children)}</span>`;
        default:
          return "";
      }
    })
    .join("");
}

function modifierClass(modifier: InlineModifier): string {
  if (modifier.kind === "color") return `lux-text-${modifier.value}`;
  if (modifier.kind === "size") return `lux-text-${modifier.value}`;
  if (modifier.kind === "weight") return `lux-font-${modifier.value}`;
  return `lux-bg-${modifier.value}`;
}

function isTabNode(node: BlockNode): node is ComponentNode {
  return node.type === "component" && node.name === "tab";
}

function gridCount(node: ComponentNode): number {
  const declared = Number(node.args[0]);
  if (Number.isInteger(declared) && declared >= 1 && declared <= 6) return declared;
  return Math.min(Math.max(node.columns?.length ?? 1, 1), 6);
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
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return "#";
  if (trimmed.startsWith("//")) return "#";
  return trimmed;
}

function liveReloadScript(): string {
  return `<script>
(() => {
  const events = new EventSource("/__lux/events");
  events.addEventListener("message", () => location.reload());
})();
</script>`;
}

function themeCss(theme: LuxTheme | undefined): string {
  if (!theme) return "";
  const declarations: string[] = [];

  for (const [token, value] of Object.entries(theme.colors ?? {})) {
    if (value) declarations.push(`  --lux-${token}: ${value};`);
  }

  if (theme.radius) declarations.push(`  --lux-radius: ${theme.radius};`);
  if (theme.font) declarations.push(`  --lux-font: ${theme.font};`);
  if (theme.maxWidth) declarations.push(`  --lux-max-width: ${theme.maxWidth};`);

  return declarations.length ? `:root {\n${declarations.join("\n")}\n}` : "";
}
