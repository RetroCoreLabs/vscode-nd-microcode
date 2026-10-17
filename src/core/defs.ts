/**
 * Definition packs from the embedded snapshot (src/generated/definitions.json,
 * written by scripts/snapshot-defs.mjs). Nothing is read from disk at run time.
 */

import snapshot from "../generated/definitions.json";
import {
  loadDefinitionsFromJSON,
  loadWideDefinitionsFromJSON,
  type AnyModel,
  type DefinitionPack,
  type Model,
  type WideModel,
  type WidePack,
  isWideModel,
} from "@nd100uc/microcode";

const data = snapshot as unknown as Record<string, unknown>;
const nd1x0Cache = new Map<Model, DefinitionPack>();
const wideCache = new Map<WideModel, WidePack>();

/** Pack of nd100, nd110, nd120 or nd120-dly. */
export function loadNd1x0(model: Model): DefinitionPack {
  let pack = nd1x0Cache.get(model);
  if (!pack) {
    pack = loadDefinitionsFromJSON(model, data as Record<string, any>);
    nd1x0Cache.set(model, pack);
  }
  return pack;
}

/** Pack of nd10, nd500 or nd5000. */
export function loadWide(model: WideModel): WidePack {
  let pack = wideCache.get(model);
  if (!pack) {
    pack = loadWideDefinitionsFromJSON(model, data as Record<string, any>);
    wideCache.set(model, pack);
  }
  return pack;
}

/** Token names of a model (for the variant guess and for the colouring). */
const nameSets = new Map<AnyModel, ReadonlySet<string>>();
export function tokenNames(model: AnyModel): ReadonlySet<string> {
  let set = nameSets.get(model);
  if (!set) {
    set = new Set(
      isWideModel(model)
        ? loadWide(model).tokens.map((t) => t.name)
        : loadNd1x0(model).tokens.map((t) => t.name),
    );
    nameSets.set(model, set);
  }
  return set;
}

/** Name sets of the six models the guess chooses between. */
export function allTokenNameSets(): Record<string, ReadonlySet<string>> {
  const out: Record<string, ReadonlySet<string>> = {};
  for (const m of ["nd10", "nd100", "nd110", "nd120", "nd500", "nd5000"] as const) {
    out[m] = tokenNames(m);
  }
  return out;
}
