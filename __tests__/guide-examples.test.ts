import { readFileSync } from "fs";
import { resolve } from "path";
import { parseOrvi } from "../src/parser";

describe("orvi-language-guide examples", () => {
  it("keeps every fenced orvi example valid", () => {
    const guide = readFileSync(
      resolve(__dirname, "..", "orvi-language-guide.md"),
      "utf8",
    );
    const examples = extractOrviFences(guide);

    expect(examples).toHaveLength(14);

    for (const example of examples) {
      const ast = parseOrvi(example.source);
      expect(ast.diagnostics).toEqual([]);
    }
  });
});

interface OrviFence {
  line: number;
  source: string;
}

function extractOrviFences(markdown: string): OrviFence[] {
  const lines = markdown.split(/\r?\n/);
  const fences: OrviFence[] = [];
  let collecting = false;
  let startLine = 0;
  let fenceMarker = "";
  let buffer: string[] = [];

  for (const [index, line] of lines.entries()) {
    const openingFence = line.trim().match(/^(`{3,})orvi$/);
    if (!collecting && openingFence) {
      collecting = true;
      startLine = index + 1;
      fenceMarker = openingFence[1];
      buffer = [];
      continue;
    }

    if (collecting && line.trim() === fenceMarker) {
      fences.push({ line: startLine, source: buffer.join("\n") });
      collecting = false;
      fenceMarker = "";
      continue;
    }

    if (collecting) {
      buffer.push(line);
    }
  }

  return fences;
}
