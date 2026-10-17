/**
 * Facts about the model names that the extension needs in several places.
 * No VS Code import: this file and the rest of src/core can be run by node.
 */

import {
  type AnyModel,
  ALL_MODELS,
  normaliseModelName,
} from "@nd100uc/microcode";

export { ALL_MODELS, normaliseModelName };
export type { AnyModel };

export interface ModelInfo {
  /** Short name shown to the user, e.g. "ND-500". */
  display: string;
  /** Longer description for lists. */
  description: string;
  wordBits: number;
  /** Colour/category family: models in a family share one colour table. */
  family: "nd10" | "nd1x0" | "nd5xx";
  /** Name of the native image written by "assemble". */
  nativeFormat: string;
  /** File extension of the main output. */
  outputExtension: string;
}

export const MODEL_INFO: Readonly<Record<AnyModel, ModelInfo>> = {
  nd10: {
    display: "NORD-10",
    description: "NORD-10 / NORD-10/S micro program (MICMAC), 32-bit word",
    wordBits: 32,
    family: "nd10",
    nativeFormat: "prom.hex text and 32-bit big-endian .CODE",
    outputExtension: ".hex",
  },
  nd100: {
    display: "ND-100",
    description: "ND-100 (3033S / 3033E-CX), 48 bits stored in 64",
    wordBits: 64,
    family: "nd1x0",
    nativeFormat: ".CODE, 10-byte records",
    outputExtension: ".CODE",
  },
  nd110: {
    display: "ND-110",
    description: "ND-110 (3095), 48 bits stored in 64, ROM storage form",
    wordBits: 64,
    family: "nd1x0",
    nativeFormat: ".CODE, 10-byte records",
    outputExtension: ".CODE",
  },
  nd120: {
    display: "ND-120",
    description: "ND-120, 64-bit word (version K register selects)",
    wordBits: 64,
    family: "nd1x0",
    nativeFormat: ".CODE, 10-byte records",
    outputExtension: ".CODE",
  },
  "nd120-dly": {
    display: "ND-120 (L)",
    description:
      "ND-120 with the version L register selects B,P / B,B / B,X (no DLY1 bit)",
    wordBits: 64,
    family: "nd1x0",
    nativeFormat: ".CODE, 10-byte records",
    outputExtension: ".CODE",
  },
  nd500: {
    display: "ND-500",
    description: "ND-500 micro program, 144-bit word, control store 8K",
    wordBits: 144,
    family: "nd5xx",
    nativeFormat: "packed18, 147456 bytes",
    outputExtension: ".CODE",
  },
  nd5000: {
    display: "ND-5000",
    description: "ND-5000 micro program, 128-bit word, control store 16K",
    wordBits: 128,
    family: "nd5xx",
    nativeFormat: "16 bytes per word, 262144 bytes",
    outputExtension: ".DATA",
  },
};

/** The names offered in lists (the canonical names, nd120-dly last of ND-120). */
export const MODEL_CHOICES: readonly AnyModel[] = ALL_MODELS;

/** Dialect facts that decide how a source line is read. */
export function hasHashComments(model: AnyModel): boolean {
  return model === "nd500" || model === "nd5000";
}
