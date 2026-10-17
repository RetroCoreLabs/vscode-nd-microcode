/**
 * "ND Microcode: Set variant for this file".
 *
 * The user picks a variant and where to keep the choice: in the folder
 * settings (nd-microcode.fileModels, key = path of the file relative to the
 * workspace folder) or as a `%#MODEL <name>` line at the top of the file.
 */

import * as vscode from "vscode";
import { findDirective } from "./core/resolver";
import { MODEL_CHOICES, MODEL_INFO, type AnyModel } from "./core/models";
import { relativePath, resolveForDocument } from "./modelResolver";

interface ModelItem extends vscode.QuickPickItem {
  model: AnyModel;
}

export async function setModelForFile(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "uc") {
    void vscode.window.showErrorMessage("Open a .uc microcode file to use this command.");
    return;
  }
  const document = editor.document;
  const current = resolveForDocument(document);

  const items: ModelItem[] = MODEL_CHOICES.map((m) => ({
    model: m,
    label: m,
    description: m === current.model ? "current" : undefined,
    detail: MODEL_INFO[m].description,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    title: "Variant of this file",
    placeHolder: `Now: ${MODEL_INFO[current.model].display} (${current.detail})`,
  });
  if (!picked) return;

  const where = await vscode.window.showQuickPick(
    [
      {
        label: "Write a %#MODEL line into this file",
        description: "travels with the file",
        key: "line",
      },
      {
        label: "Store in the folder settings",
        description: "nd-microcode.fileModels in .vscode/settings.json",
        key: "settings",
      },
    ],
    { title: `Keep "${picked.model}" for this file` },
  );
  if (!where) return;

  if (where.key === "line") {
    await writeDirective(document, picked.model);
  } else {
    await writeSetting(document, picked.model);
  }
}

async function writeDirective(document: vscode.TextDocument, model: AnyModel): Promise<void> {
  const edit = new vscode.WorkspaceEdit();
  const found = findDirective(document.getText());
  const text = `%#MODEL ${model}`;
  if (found) {
    const line = document.lineAt(found.line);
    edit.replace(document.uri, line.range, text);
  } else {
    edit.insert(document.uri, new vscode.Position(0, 0), text + "\n");
  }
  await vscode.workspace.applyEdit(edit);
}

async function writeSetting(document: vscode.TextDocument, model: AnyModel): Promise<void> {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!folder) {
    void vscode.window.showErrorMessage(
      "The file is not in a workspace folder. Write a %#MODEL line instead.",
    );
    return;
  }
  const config = vscode.workspace.getConfiguration("nd-microcode", folder.uri);
  const map = { ...(config.get<Record<string, string>>("fileModels", {}) ?? {}) };
  map[relativePath(document)] = model;
  await config.update("fileModels", map, vscode.ConfigurationTarget.WorkspaceFolder);
}
