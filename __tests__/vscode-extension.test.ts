import { readFileSync } from "fs";
import { resolve } from "path";

describe("VS Code extension scaffold", () => {
  it("declares Lux language, grammar, and snippets", () => {
    const root = resolve(__dirname, "..", "vscode", "lux");
    const pkg = readJson(resolve(root, "package.json"));
    const grammar = readJson(resolve(root, "syntaxes", "lux.tmLanguage.json"));
    const snippets = readJson(resolve(root, "snippets", "lux.json"));

    expect(pkg.contributes.languages[0]).toMatchObject({
      id: "lux",
      extensions: [".lux"]
    });
    expect(pkg.contributes.grammars[0]).toMatchObject({
      language: "lux",
      scopeName: "source.lux"
    });
    expect(grammar.scopeName).toBe("source.lux");
    expect(Object.keys(snippets)).toEqual(expect.arrayContaining(["Callout", "Grid", "Tabs", "Button"]));
  });
});

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"));
}
