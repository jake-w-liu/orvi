import fc from "fast-check";
import { parseOrvi } from "../src/parser";
import { renderOrvi } from "../src/renderer";
import { formatOrvi } from "../src/formatter";
import { renderOrviArtifact } from "../src/artifact";

// These properties are the in-repo, CI-run version of the ad-hoc fuzzing used
// during hardening: parser/renderer/formatter never throw on any input, the
// renderer never emits a live `<script>` (Orvi has no script construct, so a
// raw one would be an injection), the formatter is idempotent, and formatting
// never changes what a document renders to when it reports no content loss.

const RUNS = process.env.CI ? 1000 : 400;

// Tokens that exercise every interesting parser branch.
const TOKENS = [
  "text",
  " ",
  "\n",
  "\n\n",
  "# ",
  "###### ",
  "#",
  "- ",
  "* ",
  "1. ",
  "-",
  "*",
  "5.",
  "**",
  "_",
  "~~",
  "`code`",
  "```ts | a.ts\n",
  "```\n",
  "[red]",
  "[bg=blue size=lg]",
  "[]",
  "[callout type=info]",
  "[/callout]",
  "[grid 2]",
  "[/grid]",
  "[card bg=blue]",
  "[/card]",
  "[tabs]",
  "[/tabs]",
  "[tab label=One]",
  "[/tab]",
  "---",
  "btn: Go -> https://example.com",
  "img: ./a.png | Alt: x | y",
  "badge: Beta | type=warning",
  "hr:",
  "br:",
  "// comment",
  '"quoted"',
  "<script>alert(1)</script>",
  "</style>",
  "javascript:alert(1)",
  "|",
  "=",
  ":",
  "snake_case_var",
  "a".repeat(50),
  "[".repeat(40),
  "**".repeat(40)
];

const orviSource = fc
  .array(fc.constantFrom(...TOKENS), { minLength: 0, maxLength: 60 })
  .map((parts) => parts.join(""));

const metadataPrefix = fc
  .record({
    orvi: fc.constantFrom("0.1", "9.9", "bogus"),
    title: fc.string({ maxLength: 20 }),
    extra: fc.option(fc.string({ maxLength: 10 }), { nil: undefined })
  })
  .map(({ orvi, title, extra }) => {
    const lines = [`orvi: ${orvi}`, `title: ${title}`];
    if (extra !== undefined) lines.push(`futurekey: ${extra}`);
    return `---\n${lines.join("\n")}\n---\n`;
  });

const documentSource = fc
  .tuple(fc.option(metadataPrefix, { nil: "" }), orviSource)
  .map(([prefix, body]) => prefix + body);

function hasLiveScript(html: string): boolean {
  return /<script[\s/>]/i.test(html) || /<\/script\s*>/i.test(html);
}

function formatLoss(source: string): boolean {
  return formatOrvi(source).diagnostics.some((d) => d.code.startsWith("ORVI_FORMAT_"));
}

describe("property: parser/renderer/formatter robustness", () => {
  it("parseOrvi never throws and always returns a well-formed document", () => {
    fc.assert(
      fc.property(documentSource, (source) => {
        const ast = parseOrvi(source);
        expect(Array.isArray(ast.children)).toBe(true);
        expect(Array.isArray(ast.diagnostics)).toBe(true);
      }),
      { numRuns: RUNS }
    );
  });

  it("renderOrvi never throws and never emits a live <script>", () => {
    fc.assert(
      fc.property(documentSource, fc.boolean(), (source, fullDocument) => {
        const html = renderOrvi(source, { fullDocument }).html;
        expect(typeof html).toBe("string");
        expect(hasLiveScript(html)).toBe(false);
      }),
      { numRuns: RUNS }
    );
  });

  it("renderOrviArtifact never throws", () => {
    fc.assert(
      fc.property(documentSource, (source) => {
        const artifact = renderOrviArtifact(source);
        expect(typeof artifact.render.html).toBe("string");
        expect(hasLiveScript(artifact.render.html)).toBe(false);
        expect(Array.isArray(artifact.diagnostics)).toBe(true);
      }),
      { numRuns: RUNS }
    );
  });

  it("formatOrvi never throws and is idempotent", () => {
    fc.assert(
      fc.property(documentSource, (source) => {
        const once = formatOrvi(source).formatted;
        const twice = formatOrvi(once).formatted;
        expect(twice).toBe(once);
      }),
      { numRuns: RUNS }
    );
  });

  it("formatting does not change what a document renders to when it reports no loss", () => {
    fc.assert(
      fc.property(documentSource, (source) => {
        if (formatLoss(source)) return; // formatter already warned it would change content
        const formatted = formatOrvi(source).formatted;
        expect(renderOrvi(formatted).html).toBe(renderOrvi(source).html);
      }),
      { numRuns: RUNS }
    );
  });
});
