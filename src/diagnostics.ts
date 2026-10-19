/**
 * Assembler messages as VS Code diagnostics (the red and yellow marks in the
 * editor and the Problems list).
 */

import * as vscode from "vscode";
import { assembleForModel, type Diag } from "./core/operations";
import { resolveForDocument } from "./modelResolver";

const collection = vscode.languages.createDiagnosticCollection("vscode-nd-microcode");
let channel: vscode.OutputChannel | undefined;

export function outputChannel(): vscode.OutputChannel {
  channel ??= vscode.window.createOutputChannel("ND MicroCode");
  return channel;
}

function severityOf(d: Diag): vscode.DiagnosticSeverity {
  if (d.severity === "error") return vscode.DiagnosticSeverity.Error;
  if (d.severity === "warning") return vscode.DiagnosticSeverity.Warning;
  return vscode.DiagnosticSeverity.Information;
}

export function publishDiagnostics(document: vscode.TextDocument, diags: readonly Diag[]): void {
  const out: vscode.Diagnostic[] = [];
  for (const d of diags) {
    if (d.line <= 0 || d.line > document.lineCount) continue;
    const range = document.lineAt(d.line - 1).range;
    const diag = new vscode.Diagnostic(range, d.message, severityOf(d));
    diag.source = "vscode-nd-microcode";
    out.push(diag);
  }
  collection.set(document.uri, out);
}

/** Print the messages to the output channel, one per line. */
export function printDiagnostics(diags: readonly Diag[]): void {
  const ch = outputChannel();
  for (const d of diags) {
    const where =
      d.line > 0 ? `line ${d.line}` : "file";
    const addr = d.address !== undefined ? ` addr 0o${d.address.toString(8)}` : "";
    ch.appendLine(`${d.severity.toUpperCase()} ${where}${addr}: ${d.message}`);
  }
}

/** Assemble a document in memory and publish what the assembler says. */
export function checkDocument(document: vscode.TextDocument): void {
  if (document.languageId !== "uc") return;
  const model = resolveForDocument(document).model;
  try {
    const r = assembleForModel(document.getText(), model, { stampDate: false });
    publishDiagnostics(document, r.diagnostics);
  } catch (e) {
    collection.delete(document.uri);
    outputChannel().appendLine(
      `Could not check ${document.uri.fsPath}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function registerDiagnostics(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    collection,
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const on = vscode.workspace
        .getConfiguration("vscode-nd-microcode", doc.uri)
        .get<boolean>("diagnostics.onSave", true);
      if (on) checkDocument(doc);
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => collection.delete(doc.uri)),
  );
}
