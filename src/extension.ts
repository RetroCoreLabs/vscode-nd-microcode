/**
 * ND Microcode VSCode extension - entry point (NORD-10, ND-100, ND-110,
 * ND-120, ND-500, ND-5000).
 *
 * Registers:
 *   - hover provider (token docs, numbers) for the variant of the file
 *   - colouring by variant (semantic tokens; the TextMate grammar is the
 *     fallback)
 *   - status bar item with the variant and how it was chosen
 *   - completion for the %#MODEL line
 *   - commands: assemble, split, disassemble, show bits, set variant, check
 *   - assembler messages as diagnostics
 *
 * Which variant a file uses is decided in src/core/resolver.ts.
 */

import * as vscode from "vscode";
import { registerHoverProvider } from "./hoverProvider";
import { registerCommands } from "./commands";
import { registerBitView } from "./bitView";
import { registerStatusBar } from "./statusBar";
import { registerModelCompletion } from "./modelCompletion";
import { registerSemanticTokens } from "./semanticTokens";
import { registerDiagnostics } from "./diagnostics";
import { forgetDocument } from "./modelResolver";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(registerHoverProvider());
  context.subscriptions.push(registerBitView(context));
  context.subscriptions.push(registerModelCompletion());
  context.subscriptions.push(registerSemanticTokens());
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => forgetDocument(doc)),
  );
  registerStatusBar(context);
  registerDiagnostics(context);
  registerCommands(context);
}

export function deactivate(): void {
  // Nothing to clean up - subscriptions are handled by the extension host.
}
