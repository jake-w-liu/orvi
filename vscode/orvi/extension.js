const vscode = require("vscode");
const { execFile } = require("child_process");
const { existsSync } = require("fs");
const { copyFile, mkdtemp, readFile, rm, writeFile } = require("fs/promises");
const os = require("os");
const path = require("path");

const LANGUAGE_ID = "orvi";
const DIAGNOSTIC_SOURCE = "orvi";
const CHANGE_DEBOUNCE_MS = 300;
const COMPLETION_TRIGGER_CHARS = ["[", ":", "="];

const COMPLETION_DEFINITIONS = [
  { label: "callout", insertText: "[callout type=${1|info,warning,success,error|}]\n  $2\n[/callout]", detail: "Orvi component" },
  { label: "grid", insertText: "[grid ${1|2,3,4|}]\n  $2\n  ---\n  $3\n[/grid]", detail: "Orvi component" },
  { label: "card", insertText: "[card]\n  $1\n[/card]", detail: "Orvi component" },
  { label: "tabs", insertText: "[tabs]\n  [tab label=${1:Overview}]\n    $2\n  [/tab]\n[/tabs]", detail: "Orvi component" },
  { label: "tab", insertText: "[tab label=${1:Overview}]\n  $2\n[/tab]", detail: "Orvi component" },
  { label: "btn:", insertText: "btn: ${1:Label} -> ${2:https://example.com}", detail: "Orvi semantic prefix" },
  { label: "img:", insertText: "img: ${1:./image.jpg} | ${2:Alt text}", detail: "Orvi semantic prefix" },
  { label: "hr:", insertText: "hr:", detail: "Orvi semantic prefix" },
  { label: "br:", insertText: "br:", detail: "Orvi semantic prefix" },
  { label: "badge:", insertText: "badge: ${1:Label}", detail: "Orvi semantic prefix" },
  { label: "type=", insertText: "type=${1|info,warning,success,error|}", detail: "Orvi modifier" },
  { label: "label=", insertText: "label=${1:Overview}", detail: "Orvi modifier" },
  { label: "bg=", insertText: "bg=${1|red,blue,green,gray,muted,yellow,purple,orange,pink,cyan,white,black|}", detail: "Orvi background modifier" },
  { label: "red", insertText: "red", detail: "Orvi color modifier" },
  { label: "blue", insertText: "blue", detail: "Orvi color modifier" },
  { label: "green", insertText: "green", detail: "Orvi color modifier" },
  { label: "gray", insertText: "gray", detail: "Orvi color modifier" },
  { label: "muted", insertText: "muted", detail: "Orvi color modifier" },
  { label: "yellow", insertText: "yellow", detail: "Orvi color modifier" },
  { label: "purple", insertText: "purple", detail: "Orvi color modifier" },
  { label: "orange", insertText: "orange", detail: "Orvi color modifier" },
  { label: "pink", insertText: "pink", detail: "Orvi color modifier" },
  { label: "cyan", insertText: "cyan", detail: "Orvi color modifier" },
  { label: "white", insertText: "white", detail: "Orvi color modifier" },
  { label: "black", insertText: "black", detail: "Orvi color modifier" },
  { label: "xs", insertText: "xs", detail: "Orvi size modifier" },
  { label: "sm", insertText: "sm", detail: "Orvi size modifier" },
  { label: "md", insertText: "md", detail: "Orvi size modifier" },
  { label: "lg", insertText: "lg", detail: "Orvi size modifier" },
  { label: "xl", insertText: "xl", detail: "Orvi size modifier" },
  { label: "2xl", insertText: "2xl", detail: "Orvi size modifier" },
  { label: "light", insertText: "light", detail: "Orvi weight modifier" },
  { label: "regular", insertText: "regular", detail: "Orvi weight modifier" },
  { label: "medium", insertText: "medium", detail: "Orvi weight modifier" },
  { label: "bold", insertText: "bold", detail: "Orvi weight modifier" },
  { label: "orvi:", insertText: "orvi: 0.1", detail: "Orvi metadata key" },
  { label: "title:", insertText: "title: ${1:Document title}", detail: "Orvi metadata key" },
  { label: "lang:", insertText: "lang: ${1|en,es,fr,de,ja,zh|}", detail: "Orvi metadata key" },
  { label: "dir:", insertText: "dir: ${1|ltr,rtl,auto|}", detail: "Orvi metadata key" }
];

let diagnosticCollection;
const pendingChecks = new Map();
const documentVersions = new Map();
const pendingPreviewUpdates = new Map();
const previewPanels = new Map();
let extensionContext;

function activate(context) {
  extensionContext = context;
  diagnosticCollection = vscode.languages.createDiagnosticCollection("orvi");
  context.subscriptions.push(diagnosticCollection);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(checkDocument),
    vscode.workspace.onDidSaveTextDocument((document) => {
      checkDocument(document);
      refreshPreview(document);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      scheduleCheck(event.document);
      schedulePreviewUpdate(event.document);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      clearPendingCheck(document);
      clearPendingPreviewUpdate(document);
      documentVersions.delete(document.uri.toString());
      diagnosticCollection.delete(document.uri);
      closePreview(document);
    })
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: LANGUAGE_ID, scheme: "file" },
      { provideCompletionItems },
      ...COMPLETION_TRIGGER_CHARS
    ),
    vscode.commands.registerCommand("orvi.preview", (uri) => previewDocument(uri, vscode.ViewColumn.Active)),
    vscode.commands.registerCommand("orvi.previewToSide", (uri) => previewDocument(uri, vscode.ViewColumn.Beside))
  );

  vscode.workspace.textDocuments.forEach(checkDocument);
}

function deactivate() {
  for (const timeout of pendingChecks.values()) {
    clearTimeout(timeout);
  }
  for (const timeout of pendingPreviewUpdates.values()) {
    clearTimeout(timeout);
  }
  pendingChecks.clear();
  pendingPreviewUpdates.clear();
  documentVersions.clear();
  for (const panel of previewPanels.values()) {
    panel.dispose();
  }
  previewPanels.clear();
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
}

function scheduleCheck(document) {
  if (!isOrviFile(document)) return;
  clearPendingCheck(document);
  documentVersions.set(document.uri.toString(), document.version);
  pendingChecks.set(
    document.uri.toString(),
    setTimeout(() => checkDocument(document), CHANGE_DEBOUNCE_MS)
  );
}

function schedulePreviewUpdate(document) {
  if (!isOrviFile(document) || !previewPanels.has(document.uri.toString())) return;
  clearPendingPreviewUpdate(document);
  pendingPreviewUpdates.set(
    document.uri.toString(),
    setTimeout(() => refreshPreview(document), CHANGE_DEBOUNCE_MS)
  );
}

function checkDocument(document) {
  if (!isOrviFile(document)) return;

  clearPendingCheck(document);
  const documentKey = document.uri.toString();
  const version = document.version;
  documentVersions.set(documentKey, version);

  runOrviCheck(document, (diagnostics) => {
    if (documentVersions.get(documentKey) !== version) return;
    diagnosticCollection.set(document.uri, diagnostics);
  });
}

async function runOrviCheck(document, callback) {
  const cwd = workspaceFolderPath(document);
  let inputPath = document.uri.fsPath;
  let tempDir;

  // Check the in-memory buffer (not the stale on-disk file) so diagnostics
  // update while typing, not only on save — mirrors the preview path.
  if (document.isDirty && typeof document.getText === "function") {
    try {
      tempDir = await mkdtemp(path.join(os.tmpdir(), "orvi-check-"));
      inputPath = path.join(tempDir, path.basename(document.uri.fsPath) || "check.ov");
      await writeFile(inputPath, document.getText(), "utf8");
    } catch {
      inputPath = document.uri.fsPath;
      tempDir = undefined;
    }
  }

  const cleanup = () => {
    if (tempDir) rm(tempDir, { force: true, recursive: true }).catch(() => {});
  };

  runOrvi(["check", inputPath, "--json"], { cwd }, (error, stdout, stderr) => {
    cleanup();
    const payload = parseJson(stdout);
    if (payload) {
      callback(toVsCodeDiagnostics(payload, document));
      return;
    }

    if (error) {
      const message = stderr.trim() || error.message || "Orvi check failed.";
      callback([createDiagnostic(document, { message, severity: "error", line: 1, column: 1 })]);
      return;
    }

    callback([]);
  });
}

function provideCompletionItems() {
  return COMPLETION_DEFINITIONS.map((definition) => {
    const item = new vscode.CompletionItem(definition.label, vscode.CompletionItemKind.Snippet);
    item.detail = definition.detail;
    item.insertText = new vscode.SnippetString(definition.insertText);
    return item;
  });
}

async function previewDocument(uri, viewColumn = vscode.ViewColumn.Beside) {
  const document = await resolveTargetDocument(uri);
  if (!document) {
    vscode.window.showWarningMessage("Open or select an Orvi (.ov) file to preview.");
    return;
  }

  const documentKey = document.uri.toString();
  const existingPanel = previewPanels.get(documentKey);
  if (existingPanel) {
    existingPanel.reveal(viewColumn);
    refreshPreview(document, existingPanel);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "orviPreview",
    `Orvi Preview: ${path.basename(document.uri.fsPath)}`,
    viewColumn,
    { enableScripts: false }
  );

  previewPanels.set(documentKey, panel);
  panel.onDidDispose(() => {
    clearPendingPreviewUpdate(document);
    previewPanels.delete(documentKey);
  });

  refreshPreview(document, panel);
}

async function resolveTargetDocument(uri) {
  if (uri && uri.scheme === "file") {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      if (isOrviFile(document)) return document;
    } catch {
      return undefined;
    }
  }

  const editor = vscode.window.activeTextEditor;
  if (editor && isOrviFile(editor.document)) return editor.document;

  return undefined;
}

async function refreshPreview(document, panel = previewPanels.get(document.uri.toString())) {
  if (!panel || !isOrviFile(document)) return;
  const documentKey = document.uri.toString();
  clearPendingPreviewUpdate(document);
  panel.webview.html = renderPreviewLoading();

  try {
    const html = await buildPreviewHtml(document);
    if (previewPanels.get(documentKey) === panel) {
      panel.webview.html = html;
    }
  } catch (error) {
    if (previewPanels.get(documentKey) === panel) {
      panel.webview.html = renderPreviewError(error);
    }
  }
}

async function buildPreviewHtml(document) {
  const cwd = workspaceFolderPath(document);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "orvi-preview-"));
  const outputPath = path.join(tempDir, "preview.html");
  let inputPath = document.uri.fsPath;

  try {
    if (document.isDirty && typeof document.getText === "function") {
      inputPath = path.join(tempDir, path.basename(document.uri.fsPath) || "preview.ov");
      await writeFile(inputPath, document.getText(), "utf8");
      await copyWorkspaceConfig(document, tempDir);
    }

    await runOrviPromise(["build", inputPath, "-o", outputPath], { cwd });
    const html = await readFile(outputPath, "utf8");
    return renderPreviewFrame(html);
  } finally {
    rm(tempDir, { force: true, recursive: true }).catch(() => {});
  }
}

// When previewing an unsaved buffer we build a temp copy, so a sibling
// orvi.config.js next to the real document needs to be copied alongside it,
// otherwise the build would ignore the project's theme/lang/dir config.
async function copyWorkspaceConfig(document, tempDir) {
  const configPath = path.join(path.dirname(document.uri.fsPath), "orvi.config.js");
  if (!existsSync(configPath)) return;
  try {
    await copyFile(configPath, path.join(tempDir, "orvi.config.js"));
  } catch {
    // Best effort: the preview still renders without the project config.
  }
}

function runOrvi(args, options, callback) {
  const invocation = resolveOrviInvocation();
  const execOptions = invocation.env
    ? {
        ...options,
        env: {
          ...process.env,
          ...(options && options.env ? options.env : {}),
          ...invocation.env
        }
      }
    : options;
  execFile(invocation.command, [...invocation.argsPrefix, ...args], execOptions, callback);
}

function runOrviPromise(args, options) {
  return new Promise((resolve, reject) => {
    runOrvi(args, options, (error, stdout, stderr) => {
      if (error) {
        error.message = stderr.trim() || stdout.trim() || error.message || "Orvi preview failed.";
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function resolveOrviInvocation() {
  const configuredCliPath = vscode.workspace.getConfiguration("orvi").get("cliPath", "orvi");
  if (configuredCliPath && configuredCliPath !== "orvi") {
    return { command: configuredCliPath, argsPrefix: [] };
  }

  const bundledCliPath = extensionContext
    ? path.join(extensionContext.extensionPath, "runtime", "cli.js")
    : path.join(__dirname, "runtime", "cli.js");
  if (existsSync(bundledCliPath)) {
    return { command: process.execPath, argsPrefix: [bundledCliPath], env: { ELECTRON_RUN_AS_NODE: "1" } };
  }

  const repoCliPath = path.resolve(__dirname, "..", "..", "dist", "cli.js");
  if (existsSync(repoCliPath)) {
    return { command: process.execPath, argsPrefix: [repoCliPath], env: { ELECTRON_RUN_AS_NODE: "1" } };
  }

  return { command: configuredCliPath || "orvi", argsPrefix: [] };
}

function renderPreviewLoading() {
  return renderPreviewShell("<main class=\"state\">Building Orvi preview...</main>");
}

function renderPreviewFrame(html) {
  return renderPreviewShell(`<iframe title="Orvi preview" sandbox srcdoc="${escapeAttribute(html)}"></iframe>`);
}

function renderPreviewError(error) {
  const message = error && error.message ? error.message : "Orvi preview failed.";
  return renderPreviewShell(`<main class="state error"><h1>Orvi preview failed</h1><pre>${escapeHtml(message)}</pre></main>`);
}

function renderPreviewShell(body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    html, body, iframe { width: 100%; height: 100%; margin: 0; }
    body { background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
    iframe { border: 0; background: white; }
    .state { box-sizing: border-box; padding: 24px; font: 13px/1.5 var(--vscode-font-family); }
    .error h1 { margin: 0 0 12px; font-size: 16px; }
    .error pre { overflow: auto; white-space: pre-wrap; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function toVsCodeDiagnostics(payload, document) {
  const diagnostics = Array.isArray(payload) ? payload : payload.diagnostics;
  if (!Array.isArray(diagnostics)) return [];
  return diagnostics.map((diagnostic) => createDiagnostic(document, diagnostic));
}

function createDiagnostic(document, diagnostic) {
  const range = toRange(document, diagnostic);
  const message = diagnostic.message || diagnostic.code || "Orvi diagnostic";
  const item = new vscode.Diagnostic(range, message, toSeverity(diagnostic.severity));

  item.source = DIAGNOSTIC_SOURCE;
  if (diagnostic.code) {
    item.code = diagnostic.code;
  }

  return item;
}

function toRange(document, diagnostic) {
  const startLine = toZeroBased(diagnostic.line);
  const startColumn = toZeroBased(diagnostic.column);
  const endLine = diagnostic.endLine == null ? startLine : toZeroBased(diagnostic.endLine);
  const rawEndColumn = diagnostic.endColumn == null ? startColumn + 1 : toZeroBased(diagnostic.endColumn);
  const endColumn = endLine === startLine ? Math.max(rawEndColumn, startColumn + 1) : rawEndColumn;

  if (typeof document.validateRange === "function") {
    return document.validateRange(new vscode.Range(startLine, startColumn, endLine, endColumn));
  }

  return new vscode.Range(startLine, startColumn, endLine, endColumn);
}

function toSeverity(severity) {
  return severity === "warning" ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error;
}

function toZeroBased(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed - 1);
}

function parseJson(output) {
  if (!output || !output.trim()) return undefined;
  try {
    return JSON.parse(output);
  } catch {
    return undefined;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
  });
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function isOrviFile(document) {
  return document && document.languageId === LANGUAGE_ID && document.uri && document.uri.scheme === "file";
}

function clearPendingCheck(document) {
  const documentKey = document.uri.toString();
  const timeout = pendingChecks.get(documentKey);
  if (timeout) {
    clearTimeout(timeout);
    pendingChecks.delete(documentKey);
  }
}

function clearPendingPreviewUpdate(document) {
  const documentKey = document.uri.toString();
  const timeout = pendingPreviewUpdates.get(documentKey);
  if (timeout) {
    clearTimeout(timeout);
    pendingPreviewUpdates.delete(documentKey);
  }
}

function closePreview(document) {
  const panel = previewPanels.get(document.uri.toString());
  if (panel) {
    panel.dispose();
  }
}

function workspaceFolderPath(document) {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  return folder && folder.uri ? folder.uri.fsPath : undefined;
}

module.exports = {
  activate,
  deactivate,
  resolveOrviInvocation
};
