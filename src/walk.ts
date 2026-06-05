import type { BlockNode, DocumentNode, InlineNode } from "./ast";

/** Any node that can appear in an Orvi AST. */
export type OrviNode = DocumentNode | BlockNode | InlineNode;

/**
 * Depth-first pre-order traversal of an Orvi AST. The visitor is called on
 * `node` first, then on each descendant (block children, inline children,
 * grid columns, table header/row cells, list items). Pure — never throws on a
 * well-formed AST, and tolerates missing optional arrays.
 *
 * Uses an explicit stack rather than recursion so an arbitrarily deep AST (for
 * example one assembled by a transformer rather than the depth-capped parser)
 * cannot overflow the call stack.
 *
 * This is the supported way to build custom output or analysis on top of Orvi
 * (Orvi has no plugin API by design — see `docs/stability.md`).
 */
export function walk(node: OrviNode, visit: (node: OrviNode) => void): void {
  const stack: OrviNode[] = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    visit(current);
    const children = childNodes(current);
    // Push in reverse so siblings are visited left-to-right (pre-order).
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]!);
    }
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
    case "inlineCode":
    case "hardBreak":
    case "thematicBreak":
    case "code":
    case "semantic":
      return [];
    default:
      return [];
  }
}
