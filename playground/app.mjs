export const DEFAULT_SOURCE = `---
orvi: 0.1
title: Orvi Playground
---

# Welcome to Orvi

[blue bold] A new way to write beautiful documents. []

---

[grid 2]
  ## Why Orvi?

  Simple syntax that compiles to rich HTML. No more falling back to raw tags.
  ---
  ## Who is it for?

  Writers, developers, and AI systems that need expressive output.
[/grid]

[callout type=info]
  Orvi is currently in early development.
[/callout]

btn: Get Started -> https://orvi.dev
`;

export async function loadOrviRuntime() {
  return import("../dist/esm/renderer.js");
}

export function renderPreview(source, runtime) {
  const result = runtime.renderOrvi(source, { colorScheme: "light" });
  return {
    html: result.html,
    diagnostics: result.ast.diagnostics
  };
}

function boot(runtime) {
  const source = document.querySelector("#orvi-source");
  const preview = document.querySelector("#preview");
  const diagnostics = document.querySelector("#diagnostics");
  const status = document.querySelector("#preview-status");
  const reset = document.querySelector("#reset-source");
  const style = document.createElement("style");

  style.textContent = runtime.defaultCss;
  document.head.append(style);
  source.value = DEFAULT_SOURCE;

  const update = () => {
    const rendered = renderPreview(source.value, runtime);
    preview.innerHTML = rendered.html;
    renderDiagnostics(diagnostics, rendered.diagnostics);
    status.textContent = rendered.diagnostics.length
      ? `${rendered.diagnostics.length} diagnostic${rendered.diagnostics.length === 1 ? "" : "s"}`
      : "Live";
  };

  source.addEventListener("input", update);
  reset.addEventListener("click", () => {
    source.value = DEFAULT_SOURCE;
    source.focus();
    update();
  });

  update();
}

function renderDiagnostics(container, diagnostics) {
  container.replaceChildren();
  if (!diagnostics.length) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  const list = document.createElement("ul");
  for (const diagnostic of diagnostics) {
    const item = document.createElement("li");
    item.textContent = `${diagnostic.severity.toUpperCase()} ${diagnostic.code} at ${diagnostic.line}:${diagnostic.column} - ${diagnostic.message}`;
    list.append(item);
  }
  container.append(list);
}

async function main() {
  try {
    boot(await loadOrviRuntime());
  } catch (error) {
    const status = document.querySelector("#preview-status");
    const preview = document.querySelector("#preview");
    status.textContent = "Renderer unavailable";
    preview.textContent = `Run npm run build, then serve the repository root and open /playground/. ${error.message}`;
  }
}

if (typeof document !== "undefined") {
  main();
}
