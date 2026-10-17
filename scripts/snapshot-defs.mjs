#!/usr/bin/env node
/**
 * Snapshot the submodule's defs/ YAML files into one JSON file
 * (src/generated/definitions.json) that the extension loads without
 * touching the filesystem at runtime.
 *
 * The JSON has the same shape as lib/ts/src/generated-defs.json of the
 * submodule, so the library functions loadDefinitionsFromJSON() and
 * loadWideDefinitionsFromJSON() can read it directly:
 *
 *   { nd10: {tokens, fields}, nd100: {...}, nd110: {...}, nd120: {...},
 *     nd500: {...}, nd5000: {...} }
 *
 * nd120-dly has no entry of its own: it is nd120 plus the
 * `variant_overrides` block inside the nd120 tokens document.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load as yamlLoad } from "js-yaml";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..");
const META = resolve(REPO_ROOT, "external", "meta");

function load(relPath) {
  return yamlLoad(readFileSync(resolve(META, relPath), "utf8"));
}

const MODELS = ["nd10", "nd100", "nd110", "nd120", "nd500", "nd5000"];
const snapshot = { generatedAt: new Date().toISOString() };
for (const m of MODELS) {
  snapshot[m] = {
    tokens: load(`defs/tokens/${m}-tokens.yaml`),
    fields: load(`defs/fields/${m}-fields.yaml`),
  };
}

const outDir = resolve(here, "..", "src", "generated");
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "definitions.json"), JSON.stringify(snapshot));
console.log(
  "Snapshot: " +
    MODELS.map((m) => `${m}=${snapshot[m].tokens.tokens.length}`).join(" ") +
    " tokens",
);
