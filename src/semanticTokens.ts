/**
 * Colouring by the resolved variant (see src/core/classify.ts for the rules).
 * The TextMate grammar stays as the fallback when semantic highlighting is
 * off.
 */

import * as vscode from "vscode";
import { classifyLine, collectLabels, TOKEN_TYPES } from "./core/classify";
import { resolveForDocument } from "./modelResolver";

export const legend = new vscode.SemanticTokensLegend([...TOKEN_TYPES], []);

export function registerSemanticTokens(): vscode.Disposable {
  return vscode.languages.registerDocumentSemanticTokensProvider(
    { language: "uc" },
    {
      provideDocumentSemanticTokens(document) {
        const model = resolveForDocument(document).model;
        const labels = collectLabels(document.getText(), model);
        const builder = new vscode.SemanticTokensBuilder(legend);
        for (let i = 0; i < document.lineCount; i++) {
          const text = document.lineAt(i).text;
          if (text.length === 0) continue;
          const spans = classifyLine(text, model, labels).sort((a, b) => a.start - b.start);
          for (const s of spans) {
            builder.push(i, s.start, s.length, TOKEN_TYPES.indexOf(s.type), 0);
          }
        }
        return builder.build();
      },
    },
    legend,
  );
}
