import { readFileSync } from "fs";
import { join } from "path";
import { parseOrvi } from "../src/parser";

describe("AI authoring guidance", () => {
  it("keeps prompt guidance model-neutral", () => {
    const prompt = read("prompts/orvi-authoring-system.md");
    const docs = read("docs/ai-authoring.md");
    const blockedModelNames = ["cl" + "aude", "open" + "ai", "chat" + "gpt", "gem" + "ini"];

    for (const name of blockedModelNames) {
      expect(`${prompt}\n${docs}`.toLowerCase()).not.toContain(name);
    }
  });

  it("contains only valid fenced Orvi examples", () => {
    const combined = `${read("prompts/orvi-authoring-system.md")}\n${read("docs/ai-authoring.md")}`;
    const examples = [...combined.matchAll(/```orvi\n([\s\S]*?)```/g)].map((match) => match[1].trimEnd());

    expect(examples.length).toBeGreaterThanOrEqual(4);
    for (const example of examples) {
      const ast = parseOrvi(example);
      expect(ast.diagnostics).toEqual([]);
    }
  });
});

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}
