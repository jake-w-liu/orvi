import { renderOrvi, renderToHtml } from "../src/renderer";
import { parseOrvi } from "../src/parser";

describe("renderOrvi extension options", () => {
  describe("renderNode hook", () => {
    it("overrides the HTML for a block node and can call the default renderer", () => {
      const html = renderOrvi("# Title\n\nBody.", {
        renderNode: (node, def) => (node.type === "heading" ? `<header>${def(node)}</header>` : undefined)
      }).html;
      expect(html).toContain("<header><h1>Title</h1></header>");
      expect(html).toContain("<p>Body.</p>");
    });

    it("falls back to the default when the hook returns undefined", () => {
      const withHook = renderOrvi("# Title\n\nBody.", { renderNode: () => undefined }).html;
      const without = renderOrvi("# Title\n\nBody.").html;
      expect(withHook).toBe(without);
    });

    it("does not re-enter the hook for the default-render callback (no infinite recursion)", () => {
      let calls = 0;
      const html = renderOrvi("# A\n\n# B", {
        renderNode: (node, def) => {
          calls++;
          return node.type === "heading" ? `<x>${def(node)}</x>` : undefined;
        }
      }).html;
      // Called once per block node (the two headings), not recursively.
      expect(calls).toBe(2);
      expect(html).toContain("<x><h1>A</h1></x>");
      expect(html).toContain("<x><h1>B</h1></x>");
    });

    it("a hook returning a non-string is ignored", () => {
      const html = renderOrvi("# T", {
        renderNode: () => 123 as unknown as string | undefined
      }).html;
      expect(html).toContain("<h1>T</h1>");
    });
  });

  describe("sourceLocations", () => {
    it("annotates block elements with data-orvi-loc, including nested ones", () => {
      const html = renderOrvi("# Title\n\nBody.\n\n[callout type=info]\n  Note.\n[/callout]", {
        sourceLocations: true
      }).html;
      expect(html).toMatch(/<h1 data-orvi-loc="1:1">/);
      expect(html).toMatch(/<p data-orvi-loc="3:1">/);
      expect(html).toMatch(/<aside class="orvi-callout orvi-callout-info"[^>]*data-orvi-loc="5:1">/);
      expect(html).toMatch(/<p data-orvi-loc="6:3">Note\.<\/p>/);
    });

    it("is off by default", () => {
      expect(renderOrvi("# Title").html).not.toContain("data-orvi-loc");
    });

    it("does not throw on a malformed AST without loc", () => {
      const bad = { type: "document", metadata: {}, children: [{ type: "paragraph" }], diagnostics: [] };
      expect(() => renderToHtml(bad as unknown as ReturnType<typeof parseOrvi>, { sourceLocations: true })).not.toThrow();
    });
  });
});
