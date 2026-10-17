/**
 * Status bar item that shows the variant of the active .uc file and how it
 * was chosen. A click opens the "Set variant for this file" command.
 */

import * as vscode from "vscode";
import { MODEL_INFO } from "./core/models";
import { resolveForDocument } from "./modelResolver";

export const SET_MODEL_COMMAND = "nd-microcode.setModel";

const RULES =
  "How the variant is chosen (first rule that applies):\n" +
  "1. a %#MODEL <name> line in the first 50 lines of the file\n" +
  "2. the setting nd-microcode.fileModels (file pattern -> variant)\n" +
  "3. a guess from the words in the file (shown here, never written)\n" +
  "4. the setting nd-microcode.defaultModel\n\n" +
  "Click to set the variant for this file.";

export function registerStatusBar(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = SET_MODEL_COMMAND;
  context.subscriptions.push(item);

  const update = (): void => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "uc") {
      item.hide();
      return;
    }
    const r = resolveForDocument(editor.document);
    item.text = `ND: ${MODEL_INFO[r.model].display} (${r.detail})`;
    const problems = r.problems.length > 0 ? "\n\nProblem: " + r.problems.join("; ") : "";
    item.tooltip = `${MODEL_INFO[r.model].description}\n\n${RULES}${problems}`;
    item.backgroundColor =
      r.problems.length > 0
        ? new vscode.ThemeColor("statusBarItem.warningBackground")
        : undefined;
    item.show();
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(update),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document === vscode.window.activeTextEditor?.document) update();
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("nd-microcode")) update();
    }),
  );
  update();
}
