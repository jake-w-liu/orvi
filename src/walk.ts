import type { BlockNode, DocumentNode, InlineNode } from "./ast";

/** Any node that can appear in an Orvi AST. */
export type OrviNode = DocumentNode | BlockNode | InlineNode;

/**
 * Depth-first pre-order traversal of an Orvi AST. The visitor is called on
 * `node` first, then on each descendant (block children, inline children,
 * grid columns, table header/row cells, list items). Pure — never throws on a
 * well-formed AST, and tolerates missing optional arrays.
 *
 * This is the supported way to build custom output or analysis on top of Orvi
 * (Orvi has no plugin API by design — see `docs/stability.md`).
 */
export function walk(node: OrviNode, visit: (node: OrviNode) => void): void {
  visit(node);
  for (const child of childNodes(node)) {
    walk(child, visit);
  }
}

function childNodes(node: OrviNode): OrviNode[] {
  switch (node.type) {
    case "document":
      return node.children ?? [];
    case "heading":
    case "paragraph":
    case "strong":
    case "emphasis":
    case "strike":
    case "scope":
    case "link":
      return node.children ?? [];
    case "component":
      return [...(node.children ?? []), ...(node.columns ?? []).flat()];
    case "table":
      return [...(node.headers ?? []).flat(), ...(node.rows ?? []).flat(2)];
    case "list":
      return (node.items ?? []).flat();
    case "text":
    case "thematicBreak":
    case "code":
    case "semantic":
      return [];
    default:
      return [];
  }
}
