/**
 * VS Code command handlers.
 *
 *   vscode-nd-microcode.assembleCurrent     Assemble the active .uc file (any variant)
 *   vscode-nd-microcode.assembleAndSplit    ND-110 / ND-120: assemble + two ROM chip images
 *   vscode-nd-microcode.disassembleBinary   Open an image, produce a new .uc document
 *   vscode-nd-microcode.assembleLine        Show the assembled bits of the instruction at the cursor
 *   vscode-nd-microcode.setModel            Set the variant of this file (src/setModelCommand.ts)
 *
 * The work itself is in src/core (no VS Code calls there); this file asks the
 * user for names, writes files and shows messages.
 */

import * as vscode from "vscode";
import { promises as fs } from "node:fs";
import * as path from "node:path";

import {
  assembleSource,
  binaryToCodeBytes,
  readMicrocodeVersion,
  splitRoms,
  type Model,
} from "@nd100uc/microcode";
import { loadNd1x0 } from "./core/defs";
import { instructionState } from "./core/instruction";
import { MODEL_INFO, type AnyModel } from "./core/models";
import { assembleForModel, disassembleImage } from "./core/operations";
import {
  checkDocument,
  outputChannel,
  printDiagnostics,
  publishDiagnostics,
} from "./diagnostics";
import { resolveForDocument } from "./modelResolver";
import { setModelForFile } from "./setModelCommand";

function activeUcEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "uc") {
    void vscode.window.showErrorMessage("Open a .uc microcode file to use this command.");
    return undefined;
  }
  return editor;
}

function withoutUcExtension(fsPath: string): string {
  return fsPath.replace(/\.uc$/i, "");
}

// ---------------------------------------------------------------------------
// assembleCurrent
// ---------------------------------------------------------------------------

export async function assembleCurrentFile(): Promise<void> {
  const editor = activeUcEditor();
  if (!editor) return;
  const document = editor.document;
  const model = resolveForDocument(document).model;

  let result;
  try {
    result = assembleForModel(document.getText(), model);
  } catch (e) {
    void vscode.window.showErrorMessage(
      `Assembly failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return;
  }

  publishDiagnostics(document, result.diagnostics);
  const ch = outputChannel();
  ch.appendLine(`=== Assemble ${path.basename(document.uri.fsPath)} as ${MODEL_INFO[model].display} ===`);
  printDiagnostics(result.diagnostics);

  const warnings = result.diagnostics.filter((d) => d.severity === "warning").length;
  if (result.errorCount > 0) {
    const choice = await vscode.window.showWarningMessage(
      `Assembly completed with ${result.errorCount} error(s). Continue writing output?`,
      "Show errors",
      "Write anyway",
      "Cancel",
    );
    if (choice === "Show errors") {
      ch.show();
      return;
    }
    if (choice !== "Write anyway") return;
  }

  const main = result.files[0]!;
  const base = withoutUcExtension(document.uri.fsPath);
  const chosen = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(base + main.suffix),
    filters: { "ND MicroCode": [main.suffix.slice(1), "bin", "code"] },
  });
  const mainUri = chosen ?? vscode.Uri.file(base + main.suffix);
  const outBase = mainUri.fsPath.replace(/\.[^./\\]+$/, "");

  const written: string[] = [];
  await fs.writeFile(mainUri.fsPath, main.bytes);
  written.push(path.basename(mainUri.fsPath));
  for (const extra of result.files.slice(1)) {
    const p = outBase + extra.suffix;
    await fs.writeFile(p, extra.bytes);
    written.push(path.basename(p));
  }

  void vscode.window.showInformationMessage(
    `Assembled ${result.count} ${result.count === 1 ? "word" : "words"} (${MODEL_INFO[model].display}) to ${written.join(" + ")}` +
      (warnings > 0 ? ` (${warnings} warnings)` : ""),
  );
}

// ---------------------------------------------------------------------------
// assembleAndSplit (ND-110 and ND-120 only: two 32 KiB chips)
// ---------------------------------------------------------------------------

export async function assembleAndSplit(): Promise<void> {
  const editor = activeUcEditor();
  if (!editor) return;
  const model = resolveForDocument(editor.document).model;
  if (model !== "nd110" && model !== "nd120" && model !== "nd120-dly") {
    void vscode.window.showInformationMessage(
      `No chip split for ${MODEL_INFO[model].display}. The split makes the two 32 KiB EPROM images of the ND-110 and ND-120.`,
    );
    return;
  }

  const result = assembleSource(editor.document.getText(), loadNd1x0(model), { model });
  const errors = result.diagnostics.filter((d) => d.severity === "error");
  publishDiagnostics(editor.document, result.diagnostics);
  if (errors.length > 0) {
    const choice = await vscode.window.showWarningMessage(
      `Assembly has ${errors.length} error(s). Continue?`,
      "Yes",
      "No",
    );
    if (choice !== "Yes") return;
  }

  const outDirUri = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select output folder for ROM chip images",
  });
  if (!outDirUri || outDirUri.length === 0) return;

  const outDir = outDirUri[0]!.fsPath;
  const base = path.basename(editor.document.uri.fsPath, ".uc");
  const { highChip, lowChip } = splitRoms(result.binary, { fill: "empty" });
  await fs.writeFile(path.join(outDir, `${base}.CODE`), binaryToCodeBytes(result.binary));
  await fs.writeFile(path.join(outDir, `${base}_HIGH.bin`), highChip);
  await fs.writeFile(path.join(outDir, `${base}_LOW.bin`), lowChip);

  const version = readMicrocodeVersion(result.binary);
  void vscode.window.showInformationMessage(
    `Wrote ${base}.CODE + ${base}_HIGH.bin + ${base}_LOW.bin ` +
      `(${highChip.length} bytes each, version ` +
      `${version?.letter ?? "?"} / ${version?.octalValue ?? "?"}, model ${model})`,
  );
}

// ---------------------------------------------------------------------------
// disassembleBinary
// ---------------------------------------------------------------------------

async function readIfExists(file: string): Promise<Buffer | undefined> {
  try {
    return await fs.readFile(file);
  } catch {
    return undefined;
  }
}

export async function disassembleBinary(): Promise<void> {
  const uris = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectMany: false,
    openLabel: "Open microcode image",
    filters: {
      "ND MicroCode image": ["CODE", "code", "bin", "DATA", "data", "hex"],
      "All files": ["*"],
    },
  });
  if (!uris || uris.length === 0) return;
  const inputPath = uris[0]!.fsPath;
  const bytes = new Uint8Array(await fs.readFile(inputPath));
  const dir = path.dirname(inputPath);
  const stem = path.basename(inputPath).replace(/\.[^.]*$/, "");

  const labe = await readIfExists(path.join(dir, stem + ".LABE"));
  const symbols = await readIfExists(path.join(dir, stem + ".SYMBOLS.TXT"));

  // ND-1x0 .CODE files do not say which of the four tables they use: ask.
  let nd1x0Model: Model | undefined;
  if (bytes.length % 10 === 0 && bytes.length !== 262144 && bytes.length !== 147456) {
    const pick = await vscode.window.showQuickPick(
      [
        { label: "Detect from the words", description: "ND-110 or ND-120", model: undefined as Model | undefined },
        { label: "nd100", description: MODEL_INFO.nd100.description, model: "nd100" as Model },
        { label: "nd110", description: MODEL_INFO.nd110.description, model: "nd110" as Model },
        { label: "nd120", description: MODEL_INFO.nd120.description, model: "nd120" as Model },
        { label: "nd120-dly", description: MODEL_INFO["nd120-dly"].description, model: "nd120-dly" as Model },
      ],
      { title: "Variant of this .CODE file" },
    );
    if (!pick) return;
    nd1x0Model = pick.model;
  }

  try {
    const out = disassembleImage({
      bytes,
      fileName: path.basename(inputPath),
      labeBytes: labe ? new Uint8Array(labe) : undefined,
      symbolsText: symbols ? symbols.toString("utf8") : undefined,
      nd1x0Model,
    });
    const doc = await vscode.workspace.openTextDocument({ language: "uc", content: out.text });
    await vscode.window.showTextDocument(doc);
    void vscode.window.showInformationMessage(
      `Disassembled ${out.count} ${MODEL_INFO[out.model].display} words from ${path.basename(inputPath)}`,
    );
  } catch (e) {
    void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------------------
// assembleLine - the bits of the instruction at the cursor
// ---------------------------------------------------------------------------

export async function assembleCurrentLine(): Promise<void> {
  const editor = activeUcEditor();
  if (!editor) return;
  const model: AnyModel = resolveForDocument(editor.document).model;
  const state = instructionState(
    editor.document.getText(),
    model,
    editor.selection.active.line + 1,
  );
  if (!state) {
    void vscode.window.showInformationMessage("No instruction at cursor.");
    return;
  }

  const hex = (v: bigint): string => "0x" + v.toString(16).padStart(Math.ceil(state.wordBits / 4), "0");
  const panel = outputChannel();
  panel.show();
  panel.appendLine(`============= Assemble current instruction =============`);
  panel.appendLine(`Model:        ${model}${state.formatName ? ` (${state.formatName})` : ""}`);
  panel.appendLine(`Source line:  ${state.line}`);
  panel.appendLine(`Address:      0o${state.address.toString(8).padStart(6, "0")}`);
  panel.appendLine(`Items:        ${state.tokens.join(" ")}`);
  panel.appendLine(``);
  panel.appendLine(`Word:         ${hex(state.word)}`);
  if (state.storage !== undefined) panel.appendLine(`Storage form: ${hex(state.storage)}`);
  panel.appendLine(`Parts (octal, most significant first): ${state.partsOctal.join(" ")}`);
  panel.appendLine(``);
  panel.appendLine(`Fields:`);
  for (const r of state.rows) {
    const bits = r.hi === r.lo ? `${r.hi}` : `${r.hi}:${r.lo}`;
    panel.appendLine(`  ${r.name.padEnd(12)} (${bits.padStart(7)}) = 0o${r.value.toString(8)}`);
  }
  panel.appendLine(``);
  if (state.errors.length === 0) {
    panel.appendLine(`[OK] No validation issues.`);
  } else {
    panel.appendLine(`Validation:`);
    for (const e of state.errors) panel.appendLine(`  [issue] ${e}`);
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-nd-microcode.assembleCurrent", () => void assembleCurrentFile()),
    vscode.commands.registerCommand("vscode-nd-microcode.assembleAndSplit", () => void assembleAndSplit()),
    vscode.commands.registerCommand("vscode-nd-microcode.disassembleBinary", () => void disassembleBinary()),
    vscode.commands.registerCommand("vscode-nd-microcode.assembleLine", () => void assembleCurrentLine()),
    vscode.commands.registerCommand("vscode-nd-microcode.setModel", () => void setModelForFile()),
    vscode.commands.registerCommand("vscode-nd-microcode.checkFile", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) checkDocument(editor.document);
    }),
  );
}
