/**
 * Colouring: which kind is each word of a source line?
 *
 * Rules (decision of 2026-10-15):
 *   - the colour comes from the token's category, and there is ONE table per
 *     family: nd100/nd110/nd120 share one, nd500/nd5000 share one, nd10 has its
 *     own, so the same kind of word has the same colour in every variant of a
 *     family;
 *   - constants (octal numbers, d123 0x1F $1F o17 where the variant allows
 *     them, n,n, *n, FIELD=octal) are never "unknown";
 *   - a word that is neither a token, a constant, a label nor a field
 *     assignment is "ucUnknown".
 *
 * No VS Code import: the provider in src/semanticTokens.ts calls this.
 */

import { isWideModel } from "@nd100uc/microcode";
import { loadNd1x0, loadWide } from "./defs";
import { type AnyModel, hasHashComments } from "./models";

/** Semantic token types used (the legend of the provider, in this order). */
export const TOKEN_TYPES = [
  "variable",
  "type",
  "parameter",
  "keyword",
  "enumMember",
  "operator",
  "macro",
  "number",
  "function",
  "property",
  "comment",
  "ucUnknown",
] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

export interface Span {
  start: number;
  length: number;
  type: TokenType;
}

// ---- category -> type tables, one per family --------------------------------

const ND1X0_TABLE: Record<string, TokenType> = {
  A_REG: "variable",
  B_REG: "variable",
  AB_REG: "variable",
  PIC: "variable",
  ALUF: "type",
  ALUD: "type",
  ALUM: "type",
  STS: "type",
  CRY: "type",
  MIS: "type",
  IDBS: "parameter",
  COMM: "keyword",
  T_SEQ: "enumMember",
  T_STK: "enumMember",
  F_SEQ: "enumMember",
  F_STK: "enumMember",
  COND: "operator",
  SPECIAL: "macro",
  UNKNOWN: "property",
};

const ND10_TABLE: Record<string, TokenType> = {
  format: "keyword",
  cycle: "keyword",
  test: "operator",
  bit20_19: "macro",
  or: "macro",
  alu: "type",
  loop_alt: "type",
  loop_shift: "enumMember",
  level: "enumMember",
  dest: "variable",
  b_operand: "variable",
  a_operand: "variable",
};

/** nd500 / nd5000: categories are field names; both use these sets. */
const ND5XX_SETS: Array<[TokenType, string[]]> = [
  ["variable", ["ASEL", "BSEL", "DSEL", "A_OP", "B_OP", "DEST", "AMUX", "ASUB", "BMUX", "BSUB",
                "DGROUP", "DSUB", "IXSEL", "AA", "AB", "Q_REG", "SCAL"]],
  ["type", ["ALU_TRUE", "ALU_FALSE", "CARRY", "CARRY_FALSE", "ALU_OP", "ALU_CRY", "ALUF_OP",
            "ALUF_CRY", "EXFUNC", "EXUNIT", "EXACT", "XRES", "EXUC", "COND_ALU", "CALU"]],
  ["parameter", ["AAP_CTRL", "AACTL", "MVBUS", "AAPSYNC", "ORA", "ORB", "ORD", "ORMEM", "ORT",
                 "OR_ENABLE", "ORCON"]],
  ["keyword", ["MEM", "MEMRQ", "MEMWR", "MEMMV", "MEMNBY", "ALTMOD", "MEMOT", "ADACT", "EA_SAVE",
               "GET", "TBC", "STOP", "CMEM", "MEM_BIT3", "MEM_BITS20", "AD_ARTI", "IADJ", "IXC_INCR",
               "LCDECR", "LC_DECR"]],
  ["enumMember", ["SEQ_TRUE", "SEQ_FALSE", "SEQT_TYPE", "SEQT_STACK", "SEQF_TYPE", "SEQF_STACK",
                  "COND_SEQ", "CSEQ", "CSEQD", "ABR"]],
  ["operator", ["COND", "TESTOBJ", "INVSEQ", "CSAVE", "SET"]],
  ["macro", ["MULTI", "ARG", "ZERO", "CTRL143", "SPAREBIT", "RESERVED_36"]],
];
const ND5XX_TABLE: Record<string, TokenType> = {};
for (const [type, names] of ND5XX_SETS) for (const n of names) ND5XX_TABLE[n] = type;

function typeForCategory(model: AnyModel, category: string): TokenType {
  if (model === "nd10") return ND10_TABLE[category] ?? "property";
  if (model === "nd500" || model === "nd5000") return ND5XX_TABLE[category] ?? "property";
  return ND1X0_TABLE[category] ?? "property";
}

/** Category of a token of the model, or undefined when it is not a token. */
function categoryOf(model: AnyModel, name: string): string | undefined {
  if (isWideModel(model)) return loadWide(model).tokensByName.get(name)?.category;
  return loadNd1x0(model).tokensByName.get(name)?.category;
}

// ---- constants ----------------------------------------------------------------

const NUMBER_RES: Record<"nd1x0" | "nd10" | "nd5xx", RegExp> = {
  // octal, d123, 0x1F, $1F, o17
  nd1x0: /^(?:[0-7]+|[dD][0-9]+|0[xX][0-9A-Fa-f]+|\$[0-9A-Fa-f]+|[oO][0-7]+)$/,
  // octal, *n, *-n, *+n
  nd10: /^(?:[0-7]+|\*(?:[+-]?[0-7]+)?)$/,
  // octal with optional trailing B, and n,n
  nd5xx: /^(?:[0-7]+[Bb]?|[0-7]+[Bb]?,[0-7]+[Bb]?)$/,
};

function numberRe(model: AnyModel): RegExp {
  if (model === "nd10") return NUMBER_RES.nd10;
  if (model === "nd500" || model === "nd5000") return NUMBER_RES.nd5xx;
  return NUMBER_RES.nd1x0;
}

// ---- line scan ------------------------------------------------------------------

/** Start of the comment in a line, or -1. */
export function commentStart(line: string, model: AnyModel): number {
  const hash = hasHashComments(model);
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "%") return i;
    if (hash && c === "#" && (i === 0 || line[i - 1] === " " || line[i - 1] === "\t")) return i;
  }
  return -1;
}

/**
 * Label names defined in a document: `NAME:` (ND-1x0, ND-500, ND-5000) and
 * `NAME,` (NORD-10) as an item at the start of an instruction.
 */
export function collectLabels(text: string, model: AnyModel): Set<string> {
  const labels = new Set<string>();
  const re =
    model === "nd10"
      ? /^[ \t]*(?:[0-7]{4}:?[ \t]+(?:[0-9A-Fa-f]{8}[ \t]+)?)?((?:[A-Za-z][A-Za-z0-9_]*,[ \t]*)+)/
      : model === "nd500" || model === "nd5000"
      ? /^[ \t]*(?:[0-7]+\/[ \t]*)?([A-Za-z][A-Za-z0-9_.$]*):/
      : /^[ \t]*(?:[0-7]+\/[ \t]*)?([A-Za-z0-9_][A-Za-z0-9_.$]*):/; // ND-1x0: any text before the colon, e.g. 5INIT
  for (const raw of text.split(/\r?\n/)) {
    const cut = commentStart(raw, model);
    const line = cut >= 0 ? raw.slice(0, cut) : raw;
    const m = re.exec(line);
    if (!m) continue;
    if (model === "nd10") {
      for (const part of m[1].split(",")) {
        const name = part.trim();
        if (name) labels.add(name);
      }
    } else {
      labels.add(m[1]);
    }
  }
  return labels;
}

/** Classify the words of one source line. */
export function classifyLine(
  line: string,
  model: AnyModel,
  labels: ReadonlySet<string>,
): Span[] {
  const spans: Span[] = [];
  const cut = commentStart(line, model);
  const code = cut >= 0 ? line.slice(0, cut) : line;
  if (cut >= 0) spans.push({ start: cut, length: line.length - cut, type: "comment" });

  const numRe = numberRe(model);
  const wide = isWideModel(model) ? loadWide(model) : undefined;
  const itemRe = /\S+/g;
  let m: RegExpExecArray | null;
  let first = true;
  while ((m = itemRe.exec(code)) !== null) {
    let start = m.index;
    let item = m[0];
    // The ';' ends an instruction and is not a word.
    while (item.startsWith(";")) {
      item = item.slice(1);
      start++;
    }
    while (item.endsWith(";")) item = item.slice(0, -1);
    if (item.length === 0) continue;
    const isFirst = first;
    first = false;

    // Address markers and label definitions at the start of the line.
    if (isFirst) {
      const addr = /^([0-7]+)\/(.*)$/.exec(item);
      if (addr) {
        spans.push({ start, length: addr[1].length + 1, type: "number" });
        item = addr[2];
        start += addr[1].length + 1;
        if (item.length === 0) {
          first = true; // a label or word may follow on the same line
          continue;
        }
      }
    }
    if (model === "nd10" && /^[0-7]{4}:$/.test(item)) {
      spans.push({ start, length: item.length, type: "number" });
      continue;
    }
    if (model === "nd10" && /^[0-9A-Fa-f]{8}$/.test(item) && spans.some((s) => s.type === "number" && s.start < start)) {
      spans.push({ start, length: item.length, type: "number" });
      continue;
    }
    // ND-1x0 labels may start with a digit (5INIT:); the other variants need a letter.
    const def = (isWideModel(model)
      ? /^([A-Za-z_][A-Za-z0-9_.$]*)[:,]$/
      : /^([A-Za-z0-9_][A-Za-z0-9_.$]*)[:,]$/
    ).exec(item);
    if (def && (model === "nd10" ? item.endsWith(",") : item.endsWith(":")) && !categoryOf(model, item)) {
      spans.push({ start, length: item.length, type: "function" });
      first = true; // more labels or the first word can follow
      continue;
    }

    const category = categoryOf(model, item);
    if (category !== undefined) {
      spans.push({ start, length: item.length, type: typeForCategory(model, category) });
      continue;
    }
    if (numRe.test(item)) {
      spans.push({ start, length: item.length, type: "number" });
      continue;
    }
    const eq = item.indexOf("=");
    if (eq > 0) {
      const field = item.slice(0, eq);
      const value = item.slice(eq + 1);
      const known = wide ? wide.fieldsByName.has(field) : false;
      if (known && /^[0-7]+[Bb]?$/.test(value)) {
        spans.push({ start, length: item.length, type: "macro" });
      } else {
        spans.push({ start, length: item.length, type: "ucUnknown" });
      }
      continue;
    }
    const off = /^([A-Za-z_][A-Za-z0-9_.$]*)[+-][0-7]+$/.exec(item);
    if (labels.has(item) || (off && labels.has(off[1]))) {
      spans.push({ start, length: item.length, type: "function" });
      continue;
    }
    spans.push({ start, length: item.length, type: "ucUnknown" });
  }
  return spans;
}
