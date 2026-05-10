import { readFileSync } from "fs";
import { resolve } from "path";
import { parseLux } from "../src/parser";

describe("lux-language-guide examples", () => {
  it("keeps every fenced lux example valid", () => {
    const guide = readFileSync(resolve(__dirname, "..", "lux-language-guide.md"), "utf8");
    const examples = extractLuxFences(guide);

    expect(examples).toHaveLength(11);

    for (const example of examples) {
      const ast = parseLux(example.source);
      expect(ast.diagnostics).toEqual([]);
    }
  });
});

interface LuxFence {
  line: number;
  source: string;
}

function extractLuxFences(markdown: string): LuxFence[] {
  const lines = markdown.split(/\r?\n/);
  const fences: LuxFence[] = [];
  let collecting = false;
  let startLine = 0;
  let buffer: string[] = [];

  for (const [index, line] of lines.entries()) {
    if (!collecting && line.trim() === "```lux") {
      collecting = true;
      startLine = index + 1;
      buffer = [];
      continue;
    }

    if (collecting && line.startsWith("```")) {
      fences.push({ line: startLine, source: buffer.join("\n") });
      collecting = false;
      continue;
    }

    if (collecting) {
      buffer.push(line);
    }
  }

  return fences;
}
