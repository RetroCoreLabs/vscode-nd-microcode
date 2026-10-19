/**
 * The bits of one instruction, split into named fields, for the bit view and
 * the "show assembled bits" command. No VS Code import.
 */

import {
  ND100_XOR_MASK,
  ND110_XOR_MASK,
  assembleWide,
  extractBits,
  isWideModel,
  preprocess,
  translateInstruction,
  valueToParts,
  type WideField,
} from "@nd100uc/microcode";
import snapshot from "../generated/definitions.json";
import { loadNd1x0, loadWide } from "./defs";
import { type AnyModel, MODEL_INFO } from "./models";

export interface FieldRow {
  name: string;
  hi: number;
  lo: number;
  value: number;
  /** CSS class suffix: alu, reg, idbs, comm, seq, cond, sts, timing, special, branch. */
  color: string;
  description: string;
}

export interface InstructionState {
  model: AnyModel;
  address: number;
  /** First source line of the instruction (1-based). */
  line: number;
  tokens: string[];
  wordBits: number;
  /** 16-bit parts, most significant first, as octal numbers. */
  partsOctal: string[];
  /** The word as the assembler made it. */
  word: bigint;
  /** ND-110 and ND-100: the word in ROM storage form (bits 22-27 inverted). */
  storage?: bigint;
  /** NORD-10 only: ARITHMETIC, INTERBLOCK, JUMP or LOOP. */
  formatName?: string;
  rows: FieldRow[];
  errors: string[];
}

interface Spec {
  name: string;
  hi: number;
  lo: number;
  color: string;
  description: string;
}

/** ND-110 / ND-120 field map, MSB first. */
const ND1X0_FIELDS: Spec[] = [
  { name: "ALUI", hi: 63, lo: 55, color: "alu", description: "ALU function (composite src+func+dest, 9 bits)" },
  { name: "STS", hi: 54, lo: 53, color: "sts", description: "Status update / ALU shift mode" },
  { name: "RASEL", hi: 52, lo: 51, color: "reg", description: "A-operand select" },
  { name: "XRF", hi: 50, lo: 50, color: "special", description: "Extended register file" },
  { name: "RBSEL", hi: 49, lo: 48, color: "reg", description: "B-operand select" },
  { name: "CIN", hi: 47, lo: 46, color: "alu", description: "Carry-in select" },
  { name: "ALUM", hi: 45, lo: 44, color: "alu", description: "ALU mode modifier" },
  { name: "MIS", hi: 43, lo: 42, color: "alu", description: "Shift mode (when ALUM=MIC)" },
  { name: "IDBS", hi: 41, lo: 37, color: "idbs", description: "Internal Data Bus source" },
  { name: "COMM", hi: 36, lo: 32, color: "comm", description: "Command" },
  { name: "T_SEQ", hi: 31, lo: 30, color: "seq", description: "True-path sequence" },
  { name: "T_STK", hi: 29, lo: 28, color: "seq", description: "True-path stack op" },
  { name: "csdelay", hi: 27, lo: 26, color: "timing", description: "Delay / timing bits" },
  { name: "VECT", hi: 25, lo: 25, color: "seq", description: "Vector-jump selector" },
  { name: "SCOND", hi: 24, lo: 24, color: "cond", description: "Set condition (low 12 bits carry cond fields)" },
  { name: "ECOND", hi: 23, lo: 23, color: "cond", description: "CONDENABL - enable conditional sequencing" },
  { name: "LOOP", hi: 22, lo: 22, color: "special", description: "LCOUNT - count loop counter" },
  { name: "csdelay21", hi: 21, lo: 21, color: "timing", description: "Delay bit (timing)" },
  { name: "CSBIT20", hi: 20, lo: 20, color: "branch", description: "Address extension (high bit of 13-bit branch addr)" },
  { name: "BOP", hi: 19, lo: 16, color: "reg", description: "B-operand register" },
  { name: "AOP", hi: 15, lo: 12, color: "reg", description: "A-operand register" },
  { name: "BRANCH", hi: 11, lo: 0, color: "branch", description: "SCOND=0: branch addr bits 11:0. SCOND=1: LCC/TSEL/F_SEQ/F_STK" },
];

/**
 * ND-100: the ND-110 map with the fields that nd100-fields.yaml defines
 * differently (IDBS is 4 bits with SEXT above it, EN_EXT, VECT0, SLWCS0,
 * MAPJ0, TC). Fields of the base map that overlap a field from that file
 * are dropped; the others stay.
 */
function nd100Fields(): Spec[] {
  const doc = (snapshot as unknown as Record<string, any>).nd100.fields.fields as Record<
    string,
    { bits?: [number, number]; description?: string }
  >;
  const overlay: Spec[] = [];
  for (const [name, f] of Object.entries(doc)) {
    if (!f.bits) continue;
    overlay.push({
      name,
      hi: f.bits[0],
      lo: f.bits[1],
      color: colorOfName(name),
      description: f.description ?? "",
    });
  }
  const keep = ND1X0_FIELDS.filter(
    (s) => !overlay.some((o) => s.lo <= o.hi && o.lo <= s.hi),
  );
  return [...keep, ...overlay].sort((a, b) => b.hi - a.hi);
}

function colorOfName(name: string): string {
  const n = name.toUpperCase();
  if (/ALU|CARRY|CRY|CIN/.test(n)) return "alu";
  if (/^(A|B|D)(SEL|_OP|OP|EST)?$|^DEST$|SEL$|^A_|^B_|^AA$|^AB$|REG|^IXSEL$/.test(n)) return "reg";
  if (/IDBS/.test(n)) return "idbs";
  if (/COMM|^MEM|MEMRQ|MEMWR|MEMMV|MEMNBY|^MEM_/.test(n)) return "comm";
  if (/SEQ|VECT|MAPJ|^T_|^F_/.test(n)) return "seq";
  if (/COND|TEST|TC$|^CSAVE|INVSEQ/.test(n)) return "cond";
  if (/TIM|PRF|DLY|DELAY|SLWCS|WAIT/.test(n)) return "timing";
  if (/ADDR|ARG|BRANCH|CSA|^SHORT|^ABR/.test(n)) return "branch";
  if (/STS|STATUS|STSAV/.test(n)) return "sts";
  return "special";
}

function rowsFor(word: bigint, specs: readonly Spec[]): FieldRow[] {
  return specs.map((s) => ({
    name: s.name,
    hi: s.hi,
    lo: s.lo,
    color: s.color,
    description: s.description,
    value: extractBits(word, s.hi, s.lo),
  }));
}

function wideSpecs(fields: readonly WideField[]): Spec[] {
  return fields.map((f) => ({
    name: f.name,
    hi: f.high,
    lo: f.low,
    color: colorOfName(f.name),
    description: f.description,
  }));
}

const ND10_FORMATS = ["ARITHMETIC", "INTERBLOCK", "JUMP", "LOOP"];

function partsOf(word: bigint, wordBits: number): string[] {
  return valueToParts(word, Math.ceil(wordBits / 16)).map((p) => p.toString(8).padStart(6, "0"));
}

/**
 * The instruction at (or just before) a source line. Returns undefined when
 * the source has no instruction.
 */
export function instructionState(
  source: string,
  model: AnyModel,
  cursorLine: number,
): InstructionState | undefined {
  const info = MODEL_INFO[model];

  if (isWideModel(model)) {
    const pack = loadWide(model);
    const r = assembleWide(source, pack, { stampDate: false });
    if (r.instructions.length === 0) return undefined;
    let target = r.instructions[0]!;
    for (const ins of r.instructions) {
      if (ins.startLine <= cursorLine) target = ins;
    }
    const word = r.words.get(target.address) ?? 0n;
    let rows: FieldRow[];
    let formatName: string | undefined;
    if (model === "nd10") {
      const format = ND10_FORMATS[extractBits(word, 31, 30)]!;
      formatName = format;
      const fields = pack.allFields.filter(
        (f) => !f.formats || f.formats.includes("ALL") || f.formats.includes(format),
      );
      rows = rowsFor(word, wideSpecs(fields));
    } else if (model === "nd500") {
      const specs = wideSpecs(pack.partition);
      specs.push({
        name: "ARG",
        hi: 31,
        lo: 0,
        color: "branch",
        description: "Argument area: long argument 31-0 / CSA address 29-16 / short argument 15-0",
      });
      rows = rowsFor(word, specs);
    } else {
      rows = rowsFor(word, wideSpecs(pack.partition));
    }
    return {
      model,
      address: target.address,
      line: target.startLine,
      tokens: target.items,
      wordBits: pack.wordBits,
      partsOctal: partsOf(word, pack.wordBits),
      word,
      formatName,
      rows,
      errors: r.diagnostics
        .filter((d) => d.line >= target.startLine && d.line <= target.endLine)
        .map((d) => `line ${d.line}: ${d.message}`),
    };
  }

  const pack = loadNd1x0(model);
  const sm = preprocess(source);
  if (sm.instructions.length === 0) return undefined;
  let target = sm.instructions[0]!;
  for (const ins of sm.instructions) {
    if (ins.line <= cursorLine) target = ins;
  }
  const diagnostics: Parameters<typeof translateInstruction>[3] = [];
  const word = translateInstruction(target, pack, sm.labels, diagnostics);
  const specs = model === "nd100" ? nd100Fields() : ND1X0_FIELDS;
  return {
    model,
    address: target.address,
    line: target.line,
    tokens: target.args,
    wordBits: info.wordBits,
    partsOctal: partsOf(word, info.wordBits),
    word,
    storage: model === "nd110" ? word ^ ND110_XOR_MASK : model === "nd100" ? word ^ ND100_XOR_MASK : undefined,
    rows: rowsFor(word, specs),
    errors: diagnostics.map((d) => `line ${d.line}: ${d.message}`),
  };
}
