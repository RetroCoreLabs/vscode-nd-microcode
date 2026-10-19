/**
 * Assemble and disassemble for every variant, without any VS Code calls.
 * The commands in src/commands.ts only ask the user for names and write the
 * files this module returns.
 */

import {
  ND100_XOR_MASK,
  ND110_XOR_MASK,
  assembleSource,
  assembleWide,
  compileDisassemblerPack,
  detectBinaryFormat,
  detectForm,
  disassembleMap,
  formatProgram,
  formatProgramWide,
  isWideModel,
  parseCodeBytes,
  parseLabeBytes,
  parseSymbolsText,
  readBe16x8,
  readBe32,
  readMicrocodeVersion,
  readPacked18,
  readPromHex,
  recordsToCodeBytes,
  writePromHex,
  type BinaryFormat,
  type Model,
} from "@nd100uc/microcode";
import { loadNd1x0, loadWide } from "./defs";
import { type AnyModel, MODEL_INFO } from "./models";

export interface Diag {
  severity: "error" | "warning" | "info";
  /** 1-based source line, 0 when there is none. */
  line: number;
  address?: number;
  message: string;
}

export interface OutputFile {
  /** Added to the source file name without its extension, e.g. ".CODE". */
  suffix: string;
  bytes: Uint8Array;
  /** What the file is, for the message to the user. */
  label: string;
}

export interface AssembleOutput {
  model: AnyModel;
  /** The main file first. */
  files: OutputFile[];
  diagnostics: Diag[];
  errorCount: number;
  /** Number of instructions (words or records) assembled. */
  count: number;
}

export interface AssembleOptions {
  /** nd500: stamp the date into word 0 (default true, as the C# compiler). */
  stampDate?: boolean;
}

/** Assemble source text for any variant into the native output files. */
export function assembleForModel(
  source: string,
  model: AnyModel,
  options: AssembleOptions = {},
): AssembleOutput {
  if (isWideModel(model)) {
    const pack = loadWide(model);
    const r = assembleWide(source, pack, { stampDate: options.stampDate });
    const files: OutputFile[] = [];
    if (model === "nd10") {
      files.push({
        suffix: ".hex",
        bytes: new TextEncoder().encode(writePromHex(r.romWords ?? [])),
        label: "prom.hex text",
      });
      files.push({ suffix: ".CODE", bytes: r.image, label: "32-bit big-endian words" });
    } else if (model === "nd500") {
      files.push({ suffix: ".CODE", bytes: r.image, label: "ND-500 control store image (packed18)" });
    } else {
      files.push({ suffix: ".DATA", bytes: r.image, label: "ND-5000 control store image" });
    }
    return {
      model,
      files,
      diagnostics: r.diagnostics,
      errorCount: r.errorCount,
      count: r.words.size,
    };
  }

  const pack = loadNd1x0(model);
  const r = assembleSource(source, pack, { model });
  const bytes = recordsToCodeBytes(r.records);
  const diagnostics: Diag[] = r.diagnostics.map((d) => ({
    severity: d.severity,
    line: d.line,
    address: d.address,
    message: d.message,
  }));
  return {
    model,
    files: [{ suffix: ".CODE", bytes, label: "10-byte records" }],
    diagnostics,
    errorCount: diagnostics.filter((d) => d.severity === "error").length,
    count: r.records.length,
  };
}

// ---------------------------------------------------------------------------

export interface DisassembleInput {
  bytes: Uint8Array;
  /** File name only, for the header comment. */
  fileName: string;
  /** Contents of the .LABE file next to an ND-5000 image, if there is one. */
  labeBytes?: Uint8Array;
  /** Contents of a .SYMBOLS.TXT next to an ND-1x0 .CODE file, if there is one. */
  symbolsText?: string;
  /**
   * For ND-1x0 .CODE files: the variant, or undefined to choose nd110 or nd120
   * from the form of the words (detectForm).
   */
  nd1x0Model?: Model;
}

export interface DisassembleOutput {
  model: AnyModel;
  format: BinaryFormat;
  /** Text of the new .uc document, starts with a `%#MODEL` line. */
  text: string;
  count: number;
}

function headerLines(model: AnyModel, lines: string[]): string {
  return [`%#MODEL ${model}`, ...lines.map((l) => "% " + l), "%", ""].join("\n");
}

/**
 * Disassemble an image. The format is found from the bytes
 * (detectBinaryFormat); throws Error with a plain message when it cannot be.
 */
export function disassembleImage(input: DisassembleInput): DisassembleOutput {
  const { bytes, fileName } = input;
  const format = detectBinaryFormat(bytes);

  if (format === "packed18") {
    const pack = loadWide("nd500");
    const words = readPacked18(bytes);
    const head = headerLines("nd500", [
      `Disassembled from ${fileName}`,
      `Model: ND-500, packed18 image, ${words.length} words`,
    ]);
    return {
      model: "nd500",
      format,
      text: head + formatProgramWide(pack, words, { header: `${fileName} (lossless round-trip source)` }),
      count: words.length,
    };
  }
  if (format === "be16x8") {
    const pack = loadWide("nd5000");
    const words = readBe16x8(bytes);
    const labels = input.labeBytes ? parseLabeBytes(input.labeBytes) : undefined;
    const head = headerLines("nd5000", [
      `Disassembled from ${fileName}`,
      `Model: ND-5000, ${words.length} words`,
      labels ? `Labels loaded: ${labels.nameToAddr.size}` : "No labels loaded",
    ]);
    return {
      model: "nd5000",
      format,
      text: head + formatProgramWide(pack, words, { header: `${fileName} (lossless round-trip source)`, labels }),
      count: words.length,
    };
  }
  if (format === "prom-hex" || format === "be32") {
    const pack = loadWide("nd10");
    const rom =
      format === "prom-hex"
        ? readPromHex(new TextDecoder("ascii").decode(bytes))
        : readBe32(bytes);
    const head = headerLines("nd10", [
      `Disassembled from ${fileName}`,
      `Model: NORD-10, ${rom.length} words`,
    ]);
    return {
      model: "nd10",
      format,
      text: head + formatProgramWide(pack, rom.map((w) => BigInt(w)), { header: `${fileName} (lossless round-trip source)` }),
      count: rom.length,
    };
  }
  if (format === "code-records") {
    const microcode = parseCodeBytes(bytes);
    if (microcode.size === 0) throw new Error("No microcode records found in the file.");

    let model: Model;
    let detected = "";
    if (input.nd1x0Model) {
      model = input.nd1x0Model;
    } else {
      const form = detectForm(microcode);
      model = form.form;
      detected = ` (detected, confidence ${form.confidence.toFixed(2)})`;
    }
    // ND-110 and ND-100 images hold bits 22-27 inverted (ROM storage form); the
    // disassembler wants the canonical form. ND-120 images are canonical.
    // ND-06.031.1 chapter 4 (ND-110), ND-06.018.01 "Writing the Microprogram" (ND-100).
    const storageMask = model === "nd110" ? ND110_XOR_MASK : model === "nd100" ? ND100_XOR_MASK : 0n;
    const canonical = new Map<number, bigint>();
    for (const [addr, v] of microcode) {
      canonical.set(addr, v ^ storageMask);
    }
    const pack = loadNd1x0(model);
    let symbols: Map<number, string> | undefined;
    if (input.symbolsText) symbols = new Map(parseSymbolsText(input.symbolsText));
    const instrs = disassembleMap(canonical, compileDisassemblerPack(pack), symbols);
    const version = readMicrocodeVersion(canonical);
    const head = headerLines(model, [
      `Disassembled from ${fileName}`,
      `Model: ${MODEL_INFO[model].display}${detected}`,
      `Version: ${version?.octalValue ?? "?"} (${version?.letter ?? "?"})`,
      `Records: ${microcode.size}`,
      symbols ? `Symbols loaded: ${symbols.size}` : "No symbols loaded",
    ]);
    return {
      model,
      format,
      text: head + "\n" + formatProgram(instrs, model === "nd100" ? { model: "nd100" } : {}),
      count: microcode.size,
    };
  }

  if (bytes.length === 32768) {
    throw new Error(
      "This looks like a single 32 KiB EPROM chip. Both chips are needed: " +
        "combine them first, then open the resulting .CODE file.",
    );
  }
  throw new Error(
    `Unknown file format (${bytes.length} bytes). Known: ND-500 147456 bytes, ` +
      "ND-5000 262144 bytes, NORD-10 prom.hex or 32-bit words, ND-1x0 .CODE records.",
  );
}
