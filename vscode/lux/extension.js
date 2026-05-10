const vscode = require("vscode");
const { execFile } = require("child_process");

const LANGUAGE_ID = "lux";
const DIAGNOSTIC_SOURCE = "lux";
const CHANGE_DEBOUNCE_MS = 300;

let diagnosticCollection;
const pendingChecks = new Map();
const documentVersions = new Map();

function activate(context) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection("lux");
  context.subscriptions.push(diagnosticCollection);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(checkDocument),
    vscode.workspace.onDidSaveTextDocument(checkDocument),
    vscode.workspace.onDidChangeTextDocument((event) => scheduleCheck(event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => {
      clearPendingCheck(document);
      documentVersions.delete(document.uri.toString());
      diagnosticCollection.delete(document.uri);
    })
  );

  vscode.workspace.textDocuments.forEach(checkDocument);
}

function deactivate() {
  for (const timeout of pendingChecks.values()) {
    clearTimeout(timeout);
  }
  pendingChecks.clear();
  documentVersions.clear();
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
}

function scheduleCheck(document) {
  if (!isLuxFile(document)) return;
  clearPendingCheck(document);
  documentVersions.set(document.uri.toString(), document.version);
  pendingChecks.set(
    document.uri.toString(),
    setTimeout(() => checkDocument(document), CHANGE_DEBOUNCE_MS)
  );
}

function checkDocument(document) {
  if (!isLuxFile(document)) return;

  clearPendingCheck(document);
  const documentKey = document.uri.toString();
  const version = document.version;
  documentVersions.set(documentKey, version);

  runLuxCheck(document, (diagnostics) => {
    if (documentVersions.get(documentKey) !== version) return;
    diagnosticCollection.set(document.uri, diagnostics);
  });
}

function runLuxCheck(document, callback) {
  const cliPath = vscode.workspace.getConfiguration("lux").get("cliPath", "lux");
  const cwd = workspaceFolderPath(document);

  execFile(cliPath, ["check", document.uri.fsPath, "--json"], { cwd }, (error, stdout, stderr) => {
    const payload = parseJson(stdout);
    if (payload) {
      callback(toVsCodeDiagnostics(payload, document));
      return;
    }

    if (error) {
      const message = stderr.trim() || error.message || "Lux check failed.";
      callback([createDiagnostic(document, { message, severity: "error", line: 1, column: 1 })]);
      return;
    }

    callback([]);
  });
}

function toVsCodeDiagnostics(payload, document) {
  const diagnostics = Array.isArray(payload) ? payload : payload.diagnostics;
  if (!Array.isArray(diagnostics)) return [];
  return diagnostics.map((diagnostic) => createDiagnostic(document, diagnostic));
}

function createDiagnostic(document, diagnostic) {
  const range = toRange(document, diagnostic);
  const message = diagnostic.message || diagnostic.code || "Lux diagnostic";
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

function isLuxFile(document) {
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

function workspaceFolderPath(document) {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  return folder && folder.uri ? folder.uri.fsPath : undefined;
}

module.exports = {
  activate,
  deactivate
};
