/**
 * Completion for the `%#MODEL` line: after `%#` offer MODEL, after
 * `%#MODEL ` offer the model names.
 */

import * as vscode from "vscode";
import { MODEL_CHOICES, MODEL_INFO } from "./core/models";

export function registerModelCompletion(): vscode.Disposable {
  return vscode.languages.registerCompletionItemProvider(
    { language: "uc" },
    {
      provideCompletionItems(document, position) {
        const before = document.lineAt(position.line).text.slice(0, position.character);

        if (/^\s*%#MODEL\s+[A-Za-z0-9-]*$/i.test(before)) {
          return MODEL_CHOICES.map((m) => {
            const item = new vscode.CompletionItem(m, vscode.CompletionItemKind.EnumMember);
            item.detail = `${MODEL_INFO[m].display} - ${MODEL_INFO[m].wordBits}-bit word`;
            item.documentation = MODEL_INFO[m].description;
            return item;
          });
        }
        if (/^\s*%#[A-Za-z]*$/.test(before)) {
          const item = new vscode.CompletionItem("MODEL", vscode.CompletionItemKind.Keyword);
          item.detail = "Set the microcode variant of this file";
          item.insertText = "MODEL ";
          item.command = { command: "editor.action.triggerSuggest", title: "Suggest variant" };
          return [item];
        }
        return undefined;
      },
    },
    "#",
    " ",
  );
}
