const { Plugin, Notice } = require("obsidian");

const LUX_CODE_BLOCK_LANGUAGE = "lux";
const LUX_FILE_EXTENSION = "lux";

class LuxObsidianPlugin extends Plugin {
  onload() {
    this.runtime = loadLuxRuntime();

    this.registerMarkdownCodeBlockProcessor(LUX_CODE_BLOCK_LANGUAGE, (source, el) => {
      renderLuxIntoElement(source, el, this.runtime);
    });

    this.registerExtensions([LUX_FILE_EXTENSION], "markdown");

    this.registerMarkdownPostProcessor(async (el, ctx) => {
      if (!ctx.sourcePath || !ctx.sourcePath.toLowerCase().endsWith(".lux")) return;

      const section = typeof ctx.getSectionInfo === "function" ? ctx.getSectionInfo(el) : null;
      if (section && section.lineStart !== 0) return;

      const source = await readSourcePath(this.app, ctx.sourcePath);
      if (source === null) return;

      renderLuxIntoElement(source, el, this.runtime);
    });
  }
}

function loadLuxRuntime() {
  try {
    return require("./runtime/renderer");
  } catch (pluginRuntimeError) {
    try {
      return require("../../dist/renderer");
    } catch (_repoRuntimeError) {
      throw new Error(
        "Lux runtime is missing. Run `npm run build` from the Lux repository, then `node integrations/obsidian-lux/build.mjs` before installing the Obsidian plugin."
      );
    }
  }
}

function renderLuxIntoElement(source, el, runtime) {
  clearElement(el);

  try {
    const result = runtime.renderLux(source);
    const container = createElement(el, "div", "lux-obsidian-render");
    container.innerHTML = result.html;

    if (result.ast && Array.isArray(result.ast.diagnostics) && result.ast.diagnostics.length > 0) {
      const diagnostics = createElement(container, "details", "lux-render-diagnostics");
      const summary = createElement(diagnostics, "summary");
      summary.textContent = "Lux diagnostics";
      const list = createElement(diagnostics, "ul");
      for (const diagnostic of result.ast.diagnostics) {
        const item = createElement(list, "li");
        item.textContent = formatDiagnostic(diagnostic);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure = createElement(el, "pre", "lux-render-error");
    failure.textContent = `Lux render failed: ${message}`;

    if (typeof Notice === "function") {
      new Notice("Lux render failed. See the preview for details.");
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
  const message = diagnostic && diagnostic.message ? diagnostic.message : "Unknown Lux diagnostic.";
  return `${severity} at ${location}: ${message}`;
}

module.exports = LuxObsidianPlugin;
module.exports.LuxObsidianPlugin = LuxObsidianPlugin;
module.exports.loadLuxRuntime = loadLuxRuntime;
module.exports.renderLuxIntoElement = renderLuxIntoElement;
module.exports.readSourcePath = readSourcePath;
module.exports.formatDiagnostic = formatDiagnostic;
