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

  it("activates for Lux files and exposes CLI diagnostics configuration", () => {
    const root = resolve(__dirname, "..", "vscode", "lux");
    const pkg = readJson(resolve(root, "package.json"));

    expect(pkg.main).toBe("./extension.js");
    expect(pkg.activationEvents).toContain("onLanguage:lux");
    expect(pkg.scripts.package).toBe("vsce package");
    expect(pkg.devDependencies).toHaveProperty("@vscode/vsce");
    expect(pkg.contributes.configuration.properties["lux.cliPath"]).toMatchObject({
      type: "string",
      default: "lux"
    });
  });

  it("implements diagnostics from CLI JSON output without a build step", () => {
    const root = resolve(__dirname, "..", "vscode", "lux");
    const extension = readFileSync(resolve(root, "extension.js"), "utf8");

    expect(extension).toContain('require("vscode")');
    expect(extension).toContain('require("child_process")');
    expect(extension).toContain('createDiagnosticCollection("lux")');
    expect(extension).toContain('getConfiguration("lux").get("cliPath", "lux")');
    expect(extension).toContain('["check", document.uri.fsPath, "--json"]');
    expect(extension).toContain("onDidOpenTextDocument(checkDocument)");
    expect(extension).toContain("onDidSaveTextDocument(checkDocument)");
    expect(extension).toContain("onDidChangeTextDocument");
    expect(extension).toContain("onDidCloseTextDocument");
    expect(extension).toContain("diagnosticCollection.delete(document.uri)");
    expect(extension).toContain("diagnostic.endLine");
    expect(extension).toContain("diagnostic.endColumn");
    expect(extension).toContain("module.exports");
  });
});

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"));
}
