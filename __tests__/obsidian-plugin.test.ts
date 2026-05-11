import fs from "fs";
import path from "path";

const pluginDir = path.join(__dirname, "..", "integrations", "obsidian-orvi");

class FakePlugin {
  codeBlockProcessors: Array<{ language: string; callback: Function }> = [];
  extensions: Array<{ extensions: string[]; viewType: string }> = [];
  postProcessors: Function[] = [];
  app: unknown;

  registerMarkdownCodeBlockProcessor(language: string, callback: Function) {
    this.codeBlockProcessors.push({ language, callback });
  }

  registerExtensions(extensions: string[], viewType: string) {
    this.extensions.push({ extensions, viewType });
  }

  registerMarkdownPostProcessor(callback: Function) {
    this.postProcessors.push(callback);
  }
}

class FakeElement {
  tagName: string;
  className = "";
  textContent = "";
  innerHTML = "";
  children: FakeElement[] = [];
  parent: FakeElement | null = null;
  ownerDocument: { createElement: (tagName: string) => FakeElement };

  constructor(tagName = "div", ownerDocument?: { createElement: (tagName: string) => FakeElement }) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument ?? { createElement: (tagName) => new FakeElement(tagName, this.ownerDocument) };
  }

  get firstChild() {
    return this.children[0] ?? null;
  }

  appendChild(child: FakeElement) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: FakeElement) {
    this.children = this.children.filter((current) => current !== child);
    child.parent = null;
    return child;
  }
}

function withObsidianMock<T>(callback: () => T): T {
  const runtime = {
    renderOrvi: (source: string) => ({
      html: `<main class="orvi-document"><h1>${source.replace(/^#\s*/, "")}</h1></main>`,
      ast: { diagnostics: [] }
    })
  };

  try {
    jest.resetModules();
    jest.doMock(
      "obsidian",
      () => ({
        Plugin: FakePlugin,
        Notice: class Notice {
          constructor(_message: string) {}
        }
      }),
      { virtual: true }
    );
    jest.doMock(path.join(pluginDir, "runtime", "renderer"), () => runtime, { virtual: true });
    return callback();
  } finally {
    jest.dontMock("obsidian");
    jest.dontMock(path.join(pluginDir, "runtime", "renderer"));
    jest.resetModules();
  }
}

describe("Obsidian Orvi plugin scaffold", () => {
  it("declares the required community plugin manifest fields", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, "manifest.json"), "utf8"));

    expect(manifest).toMatchObject({
      id: "orvi",
      name: "Orvi",
      version: "0.1.0",
      minAppVersion: "1.5.0",
      description: expect.any(String),
      author: expect.any(String),
      isDesktopOnly: false
    });
    expect(manifest.id).not.toMatch(/obsidian/i);
  });

  it("registers Orvi code block rendering and .ov document preview support", () => {
    withObsidianMock(() => {
      const PluginClass = require(path.join(pluginDir, "main.js"));
      const plugin = new PluginClass() as FakePlugin;

      (plugin as unknown as { onload: () => void }).onload();

      expect(plugin.codeBlockProcessors).toHaveLength(1);
      expect(plugin.codeBlockProcessors[0].language).toBe("orvi");
      expect(plugin.extensions).toEqual([{ extensions: ["ov"], viewType: "markdown" }]);
      expect(plugin.postProcessors).toHaveLength(1);
    });
  });

  it("renders Orvi code blocks into an isolated Obsidian container", () => {
    withObsidianMock(() => {
      const PluginClass = require(path.join(pluginDir, "main.js"));
      const plugin = new PluginClass() as FakePlugin;
      (plugin as unknown as { onload: () => void }).onload();

      const root = new FakeElement();
      plugin.codeBlockProcessors[0].callback("# Hello", root);

      expect(root.children).toHaveLength(1);
      expect(root.children[0].className).toBe("orvi-obsidian-render");
      expect(root.children[0].innerHTML).toContain("orvi-document");
      expect(root.children[0].innerHTML).toContain("<h1>Hello</h1>");
    });
  });

  it("clears later Markdown sections when rendering a full .ov document preview", async () => {
    await withObsidianMock(async () => {
      const PluginClass = require(path.join(pluginDir, "main.js"));
      const plugin = new PluginClass() as FakePlugin;
      const file = { path: "note.ov" };
      plugin.app = {
        vault: {
          getAbstractFileByPath: () => file,
          cachedRead: async () => "# Full\n\nSecond section"
        }
      };
      (plugin as unknown as { onload: () => void }).onload();

      const firstSection = new FakeElement();
      const laterSection = new FakeElement();
      laterSection.appendChild(new FakeElement("p"));

      await plugin.postProcessors[0](firstSection, {
        sourcePath: "note.ov",
        getSectionInfo: () => ({ lineStart: 0 })
      });
      await plugin.postProcessors[0](laterSection, {
        sourcePath: "note.ov",
        getSectionInfo: () => ({ lineStart: 2 })
      });

      expect(firstSection.children[0].innerHTML).toContain("<h1>Full");
      expect(laterSection.children).toHaveLength(0);
    });
  });

  it("formats Orvi diagnostics with source ranges from the parser", () => {
    withObsidianMock(() => {
      const pluginModule = require(path.join(pluginDir, "main.js"));

      expect(
        pluginModule.formatDiagnostic({
          severity: "error",
          code: "ORVI_UNKNOWN_COMPONENT",
          message: "Unknown component.",
          line: 3,
          column: 5
        })
      ).toBe("error at 3:5: Unknown component.");
    });
  });

  it("documents and scripts the local runtime copy required for installation", () => {
    const buildScript = fs.readFileSync(path.join(pluginDir, "build.mjs"), "utf8");
    const readme = fs.readFileSync(path.join(pluginDir, "README.md"), "utf8");

    expect(buildScript).toContain('runtimeFiles = ["ast.js", "parser.js", "renderer.js", "styles.js"]');
    expect(buildScript).toContain("src\", \"orvi-base.css");
    expect(buildScript).toContain("orvi-obsidian-render .orvi-document");
    expect(readme).toContain("npm run build");
    expect(readme).toContain("node integrations/obsidian-orvi/build.mjs");
    expect(readme).toContain("runtime/");
  });
});
