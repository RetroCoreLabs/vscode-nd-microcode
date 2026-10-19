/**
 * Live bit-breakdown webview.
 *
 * A side panel that shows the microinstruction word for the
 * instruction under the cursor, broken down into its named fields
 * with per-field values (octal + decimal) and colour-coded by category.
 *
 * The view subscribes to cursor changes in any .uc editor and updates
 * automatically. When the cursor moves into a new instruction, the
 * entire bit grid refreshes.
 */

import * as vscode from "vscode";
import { instructionState, type InstructionState } from "./core/instruction";
import { resolveForDocument } from "./modelResolver";

const BIT_VIEW_VIEW_TYPE = "vscode-nd-microcode.bitView";

function toBinary(v: bigint, bits: number): string {
  let out = "";
  for (let i = bits - 1; i >= 0; i--) {
    out += (v >> BigInt(i)) & 1n ? "1" : "0";
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderHtml(state: InstructionState | undefined): string {
  const styles = `
    body {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 8px;
    }
    .header { font-weight: bold; margin-bottom: 8px; }
    .header .addr { color: var(--vscode-textLink-foreground); }
    .tokens { margin-bottom: 12px; opacity: 0.8; font-family: monospace; }
    .bit-grid { display: flex; flex-wrap: wrap; margin-bottom: 8px; }
    .bit {
      width: 18px; height: 22px;
      display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid var(--vscode-panel-border);
      font-size: 10px; font-weight: bold;
      margin: 1px;
    }
    .bit.set { background: var(--vscode-editorInfo-foreground); color: var(--vscode-editor-background); }
    .bit.clear { background: var(--vscode-editor-background); opacity: 0.5; }
    .bit-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
    .bit-range { width: 70px; opacity: 0.7; font-size: 10px; }
    table { border-collapse: collapse; width: 100%; font-size: 11px; }
    th, td {
      text-align: left;
      padding: 4px 6px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    th { opacity: 0.8; font-weight: normal; }
    td.value { font-family: monospace; font-weight: bold; }
    td.desc { opacity: 0.7; font-size: 10px; }
    .color-alu     td:first-child { border-left: 3px solid #4fc3f7; padding-left: 4px; }
    .color-reg     td:first-child { border-left: 3px solid #81c784; padding-left: 4px; }
    .color-idbs    td:first-child { border-left: 3px solid #ffb74d; padding-left: 4px; }
    .color-comm    td:first-child { border-left: 3px solid #f06292; padding-left: 4px; }
    .color-seq     td:first-child { border-left: 3px solid #ba68c8; padding-left: 4px; }
    .color-cond    td:first-child { border-left: 3px solid #ff8a65; padding-left: 4px; }
    .color-sts     td:first-child { border-left: 3px solid #90a4ae; padding-left: 4px; }
    .color-timing  td:first-child { border-left: 3px solid #9e9e9e; padding-left: 4px; opacity: 0.6; }
    .color-special td:first-child { border-left: 3px solid #ffd54f; padding-left: 4px; }
    .color-branch  td:first-child { border-left: 3px solid #7986cb; padding-left: 4px; }
    .empty {
      display: flex; align-items: center; justify-content: center;
      min-height: 200px;
      opacity: 0.5;
      text-align: center;
    }
    .error { color: var(--vscode-errorForeground); }
  `;

  if (!state) {
    return `<!DOCTYPE html>
<html><head><style>${styles}</style></head><body>
<div class="empty">
  <div>Place cursor in a .uc microcode file<br>to see the bit breakdown.</div>
</div>
</body></html>`;
  }

  // Visual bit grid: rows of 16 bits, MSB first (one row per 16-bit part).
  const bits = state.wordBits;
  const binary = toBinary(state.word, bits);
  const rowsCount = Math.ceil(bits / 16);
  const bitGrid: string[] = [];
  for (let row = 0; row < rowsCount; row++) {
    const hi = bits - 1 - row * 16;
    const lo = Math.max(hi - 15, 0);
    const rowBits: string[] = [];
    for (let bitIdx = hi; bitIdx >= lo; bitIdx--) {
      const bit = binary[bits - 1 - bitIdx];
      rowBits.push(
        `<div class="bit ${bit === "1" ? "set" : "clear"}" title="bit ${bitIdx}">${bitIdx}</div>`,
      );
    }
    bitGrid.push(
      `<div class="bit-row"><span class="bit-range">${hi}..${lo}</span>${rowBits.join("")}</div>`,
    );
  }

  // Field table.
  const rows: string[] = [];
  for (const f of state.rows) {
    const width = f.hi - f.lo + 1;
    const binStr = f.value.toString(2).padStart(Math.min(width, 64), "0");
    const octStr = "0o" + f.value.toString(8);
    const bitsLabel = f.hi === f.lo ? `${f.hi}` : `${f.hi}:${f.lo}`;
    rows.push(
      `<tr class="color-${f.color}">` +
      `<td>${escapeHtml(f.name)}</td>` +
      `<td><code>${bitsLabel}</code></td>` +
      `<td class="value"><code>${binStr}</code></td>` +
      `<td class="value">${octStr}</td>` +
      `<td class="value">${f.value}</td>` +
      `<td class="desc">${escapeHtml(f.description)}</td>` +
      `</tr>`,
    );
  }

  const errorsBlock = state.errors.length > 0
    ? `<div class="error"><strong>Validation:</strong><ul>${state.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>`
    : "";
  const hexDigits = Math.ceil(bits / 4);
  const storageLine = state.storage !== undefined
    ? `<br><strong>ROM storage:</strong> <code>0x${state.storage.toString(16).padStart(hexDigits, "0")}</code>`
    : "";
  const formatName = state.formatName ? ` &middot; ${escapeHtml(state.formatName)}` : "";

  return `<!DOCTYPE html>
<html><head><style>${styles}</style></head><body>
<div class="header">
  <span class="addr">0o${state.address.toString(8).padStart(6, "0")}</span>
  <span>&middot; line ${state.line}</span>
  <span>&middot; model ${escapeHtml(state.model)}${formatName}</span>
  <span>&middot; ${bits} bits</span>
</div>
<div class="tokens">${escapeHtml(state.tokens.join(" "))}</div>
<div class="bit-grid">${bitGrid.join("")}</div>
<div>
  <strong>Word:</strong> <code>0x${state.word.toString(16).padStart(hexDigits, "0")}</code>${storageLine}<br>
  <strong>Parts (octal):</strong> <code>${state.partsOctal.join(" ")}</code>
</div>
<br>
<table>
  <thead>
    <tr>
      <th>Field</th><th>Bits</th><th>Binary</th><th>Octal</th><th>Decimal</th><th>Meaning</th>
    </tr>
  </thead>
  <tbody>${rows.join("")}</tbody>
</table>
${errorsBlock}
</body></html>`;
}

// ---------------------------------------------------------------------------
// Panel lifecycle
// ---------------------------------------------------------------------------

class BitViewController {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  private lastInstructionKey = "";

  open(context: vscode.ExtensionContext): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    this.panel = vscode.window.createWebviewPanel(
      BIT_VIEW_VIEW_TYPE,
      "ND MicroCode Bit View",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: false, retainContextWhenHidden: true },
    );
    this.panel.webview.html = renderHtml(undefined);

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      for (const d of this.disposables) d.dispose();
      this.disposables = [];
      this.lastInstructionKey = "";
    }, null, context.subscriptions);

    // Refresh on cursor moves / active-editor changes / document edits.
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((e) => this.refresh(e.textEditor)),
      vscode.window.onDidChangeActiveTextEditor((e) => this.refresh(e)),
      vscode.workspace.onDidChangeTextDocument((e) => {
        const active = vscode.window.activeTextEditor;
        if (active && e.document === active.document) this.refresh(active, true);
      }),
    );

    // Initial render from the currently-active editor, if any.
    this.refresh(vscode.window.activeTextEditor);
  }

  private refresh(editor: vscode.TextEditor | undefined, force = false): void {
    if (!this.panel) return;
    if (!editor || editor.document.languageId !== "uc") {
      this.panel.webview.html = renderHtml(undefined);
      this.lastInstructionKey = "";
      return;
    }
    let state: InstructionState | undefined;
    try {
      state = instructionState(
        editor.document.getText(),
        resolveForDocument(editor.document).model,
        editor.selection.active.line + 1,
      );
    } catch (e) {
      void vscode.window.showErrorMessage(
        `Bit view failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      state = undefined;
    }
    if (!state) {
      this.panel.webview.html = renderHtml(undefined);
      this.lastInstructionKey = "";
      return;
    }
    // Avoid redundant re-renders when the cursor stays within the same
    // instruction (unless a file-edit forced us to re-evaluate).
    const key = `${editor.document.uri.toString()}|${state.model}|${state.address}|${state.line}|${state.word.toString(16)}`;
    if (key === this.lastInstructionKey && !force) return;
    this.lastInstructionKey = key;
    this.panel.webview.html = renderHtml(state);
  }
}

// Module-level singleton; the panel is unique per VSCode session.
const controller = new BitViewController();

export function registerBitView(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand(
    "vscode-nd-microcode.openBitView",
    () => controller.open(context),
  );
}
