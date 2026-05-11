import { readFileSync } from "fs";
import { resolve } from "path";

describe("VS Code extension scaffold", () => {
  it("declares Orvi language, grammar, and snippets", () => {
    const root = resolve(__dirname, "..", "vscode", "orvi");
    const pkg = readJson(resolve(root, "package.json"));
    const grammar = readJson(resolve(root, "syntaxes", "orvi.tmLanguage.json"));
    const snippets = readJson(resolve(root, "snippets", "orvi.json"));

    expect(pkg.contributes.languages[0]).toMatchObject({
      id: "orvi",
      extensions: [".ov"]
    });
    expect(pkg.contributes.grammars[0]).toMatchObject({
      language: "orvi",
      scopeName: "source.orvi"
    });
    expect(grammar.scopeName).toBe("source.orvi");
    expect(Object.keys(snippets)).toEqual(expect.arrayContaining(["Callout", "Grid", "Tabs", "Button"]));
  });

  it("activates for Orvi files and exposes CLI diagnostics configuration", () => {
    const root = resolve(__dirname, "..", "vscode", "orvi");
    const pkg = readJson(resolve(root, "package.json"));

    expect(pkg.main).toBe("./extension.js");
    expect(pkg.activationEvents).toContain("onLanguage:orvi");
    expect(pkg.scripts.package).toBe("npm run prepare-runtime && vsce package");
    expect(pkg.scripts["prepare-runtime"]).toBe("node scripts/prepare-runtime.mjs");
    expect(pkg.devDependencies).toHaveProperty("@vscode/vsce");
    expect(pkg.contributes.configuration.properties["orvi.cliPath"]).toMatchObject({
      type: "string",
      default: "orvi"
    });
  });

  it("implements diagnostics from CLI JSON output without a build step", () => {
    const root = resolve(__dirname, "..", "vscode", "orvi");
    const extension = readFileSync(resolve(root, "extension.js"), "utf8");

    expect(extension).toContain('require("vscode")');
    expect(extension).toContain('require("child_process")');
    expect(extension).toContain('require("fs")');
    expect(extension).toContain('createDiagnosticCollection("orvi")');
    expect(extension).toContain('getConfiguration("orvi").get("cliPath", "orvi")');
    expect(extension).toContain('path.join(extensionContext.extensionPath, "runtime", "cli.js")');
    expect(extension).toContain("process.execPath");
    expect(extension).toContain("ELECTRON_RUN_AS_NODE");
    expect(extension).toContain('["check", inputPath, "--json"]');
    expect(extension).toContain("document.isDirty");
    expect(extension).toContain('mkdtemp(path.join(os.tmpdir(), "orvi-check-"');
    expect(extension).toContain("onDidOpenTextDocument(checkDocument)");
    expect(extension).toContain("onDidSaveTextDocument");
    expect(extension).toContain("onDidChangeTextDocument");
    expect(extension).toContain("onDidCloseTextDocument");
    expect(extension).toContain("diagnosticCollection.delete(document.uri)");
    expect(extension).toContain("diagnostic.endLine");
    expect(extension).toContain("diagnostic.endColumn");
    expect(extension).toContain("module.exports");
  });

  it("registers Orvi autocomplete for components, prefixes, modifiers, and metadata", () => {
    const root = resolve(__dirname, "..", "vscode", "orvi");
    const extension = readFileSync(resolve(root, "extension.js"), "utf8");

    expect(extension).toContain("registerCompletionItemProvider");
    expect(extension).toContain("{ language: LANGUAGE_ID, scheme: \"file\" }");
    expect(extension).toContain("provideCompletionItems");
    expect(extension).toContain("new vscode.SnippetString");

    for (const label of [
      "callout",
      "grid",
      "card",
      "tabs",
      "tab",
      "btn:",
      "img:",
      "hr:",
      "br:",
      "badge:",
      "bg=",
      "red",
      "blue",
      "green",
      "gray",
      "yellow",
      "purple",
      "orange",
      "pink",
      "cyan",
      "white",
      "black",
      "xs",
      "sm",
      "md",
      "lg",
      "xl",
      "2xl",
      "light",
      "regular",
      "medium",
      "bold",
      "orvi:",
      "title:",
      "lang:",
      "dir:"
    ]) {
      expect(extension).toContain(`label: "${label}"`);
    }
  });

  it("contributes Orvi preview commands, menus, and keybindings", () => {
    const root = resolve(__dirname, "..", "vscode", "orvi");
    const pkg = readJson(resolve(root, "package.json"));

    expect(pkg.activationEvents).toContain("onLanguage:orvi");
    expect(pkg.contributes.commands).toContainEqual({
      command: "orvi.preview",
      title: "Orvi: Open Preview",
      category: "Orvi"
    });
    expect(pkg.contributes.commands).toContainEqual({
      command: "orvi.previewToSide",
      title: "Orvi: Open Preview to the Side",
      category: "Orvi"
    });
    expect(pkg.contributes.menus["editor/title"]).toContainEqual({
      command: "orvi.previewToSide",
      when: "resourceLangId == orvi",
      group: "navigation"
    });
    expect(pkg.contributes.menus["editor/context"]).toContainEqual({
      command: "orvi.preview",
      when: "resourceLangId == orvi",
      group: "navigation@1"
    });
    expect(pkg.contributes.menus["explorer/context"]).toContainEqual({
      command: "orvi.preview",
      when: "resourceExtname == .ov",
      group: "navigation@1"
    });
    expect(pkg.contributes.menus.commandPalette).toContainEqual({
      command: "orvi.preview",
      when: "resourceLangId == orvi"
    });
    expect(pkg.contributes.keybindings).toContainEqual({
      command: "orvi.preview",
      key: "ctrl+shift+v",
      mac: "cmd+shift+v",
      when: "editorLangId == orvi"
    });
    expect(pkg.contributes.keybindings).toContainEqual({
      command: "orvi.previewToSide",
      key: "ctrl+k v",
      mac: "cmd+k v",
      when: "editorLangId == orvi"
    });
  });

  it("implements a webview preview using orvi build and robust error UI", () => {
    const root = resolve(__dirname, "..", "vscode", "orvi");
    const extension = readFileSync(resolve(root, "extension.js"), "utf8");

    expect(extension).toContain('registerCommand("orvi.preview"');
    expect(extension).toContain("createWebviewPanel");
    expect(extension).toContain("previewPanels");
    expect(extension).toContain("schedulePreviewUpdate(event.document)");
    expect(extension).toContain("refreshPreview(document)");
    expect(extension).toContain("Orvi Preview:");
    expect(extension).toContain('["build", inputPath, "-o", outputPath]');
    expect(extension).toContain("document.isDirty");
    expect(extension).toContain("writeFile(inputPath, document.getText(), \"utf8\")");
    expect(extension).toContain("copyWorkspaceConfig(document, tempDir)");
    expect(extension).toContain('"orvi.config.js"');
    expect(extension).toContain('readFile(outputPath, "utf8")');
    expect(extension).toContain("renderPreviewFrame");
    expect(extension).toContain('sandbox srcdoc="${escapeAttribute(html)}"');
    expect(extension).toContain("Orvi preview failed");
    expect(extension).toContain("escapeHtml(message)");
    expect(extension).toContain("rm(tempDir, { force: true, recursive: true })");
  });
});

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"));
}
