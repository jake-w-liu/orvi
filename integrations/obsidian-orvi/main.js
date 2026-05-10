const { Plugin, Notice } = require("obsidian");

const ORVI_CODE_BLOCK_LANGUAGE = "orvi";
const ORVI_FILE_EXTENSION = "ov";

class OrviObsidianPlugin extends Plugin {
  onload() {
    this.runtime = loadOrviRuntime();

    this.registerMarkdownCodeBlockProcessor(ORVI_CODE_BLOCK_LANGUAGE, (source, el) => {
      renderOrviIntoElement(source, el, this.runtime);
    });

    this.registerExtensions([ORVI_FILE_EXTENSION], "markdown");

    this.registerMarkdownPostProcessor(async (el, ctx) => {
      if (!ctx.sourcePath || !ctx.sourcePath.toLowerCase().endsWith(".ov")) return;

      const section = typeof ctx.getSectionInfo === "function" ? ctx.getSectionInfo(el) : null;
      if (section && section.lineStart !== 0) return;

      const source = await readSourcePath(this.app, ctx.sourcePath);
      if (source === null) return;

      renderOrviIntoElement(source, el, this.runtime);
    });
  }
}

function loadOrviRuntime() {
  try {
    return require("./runtime/renderer");
  } catch (pluginRuntimeError) {
    try {
      return require("../../dist/renderer");
    } catch (_repoRuntimeError) {
      throw new Error(
        "Orvi runtime is missing. Run `npm run build` from the Orvi repository, then `node integrations/obsidian-orvi/build.mjs` before installing the Obsidian plugin."
      );
    }
  }
}

function renderOrviIntoElement(source, el, runtime) {
  clearElement(el);

  try {
    const result = runtime.renderOrvi(source);
    const container = createElement(el, "div", "orvi-obsidian-render");
    container.innerHTML = result.html;

    if (result.ast && Array.isArray(result.ast.diagnostics) && result.ast.diagnostics.length > 0) {
      const diagnostics = createElement(container, "details", "orvi-render-diagnostics");
      const summary = createElement(diagnostics, "summary");
      summary.textContent = "Orvi diagnostics";
      const list = createElement(diagnostics, "ul");
      for (const diagnostic of result.ast.diagnostics) {
        const item = createElement(list, "li");
        item.textContent = formatDiagnostic(diagnostic);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure = createElement(el, "pre", "orvi-render-error");
    failure.textContent = `Orvi render failed: ${message}`;

    if (typeof Notice === "function") {
      new Notice("Orvi render failed. See the preview for details.");
    }
  }
}

async function readSourcePath(app, sourcePath) {
  const file = app && app.vault && typeof app.vault.getAbstractFileByPath === "function"
    ? app.vault.getAbstractFileByPath(sourcePath)
    : null;

  if (!file || !app.vault || typeof app.vault.cachedRead !== "function") {
    return null;
  }

  return app.vault.cachedRead(file);
}

function createElement(parent, tagName, className) {
  const element = parent.ownerDocument
    ? parent.ownerDocument.createElement(tagName)
    : document.createElement(tagName);

  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

function clearElement(el) {
  if (typeof el.empty === "function") {
    el.empty();
    return;
  }

  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function formatDiagnostic(diagnostic) {
  const location =
    diagnostic && Number.isFinite(diagnostic.line) && Number.isFinite(diagnostic.column)
      ? `${diagnostic.line}:${diagnostic.column}`
      : "unknown";
  const severity = diagnostic && diagnostic.severity ? diagnostic.severity : "diagnostic";
  const message = diagnostic && diagnostic.message ? diagnostic.message : "Unknown Orvi diagnostic.";
  return `${severity} at ${location}: ${message}`;
}

module.exports = OrviObsidianPlugin;
module.exports.OrviObsidianPlugin = OrviObsidianPlugin;
module.exports.loadOrviRuntime = loadOrviRuntime;
module.exports.renderOrviIntoElement = renderOrviIntoElement;
module.exports.readSourcePath = readSourcePath;
module.exports.formatDiagnostic = formatDiagnostic;
