# Generating the extension data from the YAML files

The extension has no hand-written token tables. Token names, bit patterns,
colouring rules, hover texts and the data for the assembler and
disassembler all come from YAML files in the `nd-microcode-meta` submodule,
which is checked out at `external/meta/` in this repository.

This page describes the steps from the YAML files to the shipped
extension, and what to run after editing a YAML file.

---

## 1. Quick start

All commands run in the repository root.

```bash
git submodule update --init --recursive      # if external/meta is empty
cd external/meta/lib/ts && npm ci && npm run build && cd -   # the shared library, once
npm install                                  # once
npm run build                                # generate + compile + bundle
npm run package                              # build, then make nd-microcode.vsix
```

`npm run build` runs three steps, in this order:

| Step | Command | Writes |
|------|---------|--------|
| 1 | `npm run generate` (runs the two scripts below) | see below |
| 2 | `npm run compile` (`tsc -p ./`) | type check only, output in `out/` |
| 3 | `npm run bundle` (`scripts/build-bundle.mjs`) | `out/extension.js` |

`npm run generate` runs two scripts:

| Script | Writes |
|--------|--------|
| `scripts/generate-hover-data.mjs` | `src/generated/token-hover.json`, `src/generated/nd120-only-tokens.json`, `syntaxes/uc.tmLanguage.json` |
| `scripts/snapshot-defs.mjs` | `src/generated/definitions.json` |

The bundle step uses esbuild. It puts the `@nd100uc/microcode` library
(`external/meta/lib/ts`) inside `out/extension.js`, so the `.vsix` needs
nothing else. esbuild prints a warning about `import.meta`. It is harmless:
the extension never calls the library function that uses it.

---

## 2. The YAML files

All paths are below `external/meta/defs/`.

| File | Content |
|------|---------|
| `tokens/nd10-tokens.yaml`, `nd100-tokens.yaml`, `nd110-tokens.yaml`, `nd120-tokens.yaml`, `nd500-tokens.yaml`, `nd5000-tokens.yaml` | Every token of that variant with its bits |
| `fields/nd10-fields.yaml` ... `nd5000-fields.yaml` | The bit fields of one instruction of that variant |
| `runtime/data-flow.yaml` | What a token does: ALU formulas, IDBS sources, COMM effects, ALUD behaviour, ALU sources |
| `format/assembly-format.yaml` | The layout rules of the source text |
| `common/registers.yaml`, `common/conditions.yaml` | Register names and condition codes |

`nd120-dly` (ND-120 version L) has no file of its own. It is `nd120` with the
`variant_overrides` block at the end of `nd120-tokens.yaml` applied.

### A token entry

The ND-110 and ND-120 files describe a word of four 16-bit parts, written in
octal: `w4` is bits 63:48, `w3` bits 47:32, `w2` bits 31:16, `w1` bits 15:0.
The tokens of one instruction are OR'ed together.

```yaml
- token: "A,D"
  category: A_REG
  display_line: 1
  encoding: { w4: "000000", w3: "000000", w2: "000000", w1: "010000" }
  description: A-OP. IS 1. USED TO ADDR. THE D-REGISTER
  provides: A
  models: [nd100, nd110, nd120]
```

A token that exists only in the ND-120 file has `nd120_only: true` and
`models: [nd120]`.

### The runtime file

`runtime/data-flow.yaml` has these sections that reach the extension:
`aluf_formulas`, `idbs_sources`, `comm_effects`, `alud_behavior` and
`alu_sources`.

```yaml
aluf_formulas:
  "ALUF,PASSD": "F = D"

comm_effects:
  "COMM,LDGPR":
    reads: IDB
    writes: "GPR register"
```

---

## 3. What the generator writes

### 3.1 `src/generated/token-hover.json`

Read by `src/hoverProvider.ts`. Top-level keys: `generatedFrom`,
`generatedAt`, `tokenCount`, `tokens`, `runtime`.

- `tokens` is keyed by token name. Each entry has `name`, `category`,
  `displayLine`, `description`, `models`, `nd120Only`, `provides`,
  `encoding` and `encodings` (one encoding per model, because the bits of one
  name can differ between models).
- `runtime` has `alufFormulas`, `idbsSources`, `commEffects`, `aludBehavior`
  and `aluSources`, copied from `runtime/data-flow.yaml`.

### 3.2 `src/generated/nd120-only-tokens.json`

A list of the token names that exist only for the ND-120. A token is on the
list when its `models` is exactly `nd120`.

### 3.3 `src/generated/definitions.json`

One snapshot of all six `tokens` and `fields` files:
`{ nd10: {tokens, fields}, nd100: {...}, nd110: {...}, nd120: {...}, nd500: {...}, nd5000: {...} }`.
It has the same shape as `lib/ts/src/generated-defs.json` in the submodule, so
the library functions `loadDefinitionsFromJSON` and
`loadWideDefinitionsFromJSON` read it directly. `src/core/defs.ts` makes the
definition packs from it when the extension starts. Nothing is read from disk
at run time.

### 3.4 `syntaxes/uc.tmLanguage.json`

The TextMate grammar, written by `scripts/generate-hover-data.mjs` from the
token files. It has one named pattern for each token category (`A_REG`,
`B_REG`, `AB_REG`, `PIC`, `ALUF`, `ALUD`, `ALUM`, `STS`, `CRY`, `MIS`, `IDBS`,
`COMM`, `TF`, `COND`, `SPECIAL`), a `nd120Only` pattern, an `opcodes` and a
`wideModels` pattern for the wide variants, and the patterns for comments,
labels, address markers, `END` and numbers. The colours you see while editing
come mostly from the semantic tokens (`src/core/classify.ts`), which use the
variant of the file. See [Hover and colours](hover-and-colours.md).

Never edit `src/generated/` or `syntaxes/uc.tmLanguage.json` by hand. The
next `npm run generate` overwrites them.

---

## 4. What to do after an edit

### A token description or bit pattern

1. Edit the entry in `external/meta/defs/tokens/<variant>-tokens.yaml`.
2. In the repository root: `npm run build`.
3. Press `F5` in VS Code to try it in an Extension Dev Host.
4. To install it: `npm run package`, then
   `code --install-extension nd-microcode.vsix`.

The submodule is its own repository. Commit and push the YAML change there
first, then commit the new submodule pointer in this repository.

### A new hover fact (what a COMM or IDBS token does)

1. Add the entry to the right section of
   `external/meta/defs/runtime/data-flow.yaml`, for example:

   ```yaml
   comm_effects:
     "COMM,FOO":
       reads: IDB
       writes: "My register"
   ```

2. Run `npm run build`. The entry arrives in
   `src/generated/token-hover.json` under `runtime.commEffects`.
3. `src/hoverProvider.ts` reads these sections, so a new entry needs no
   TypeScript change.

### A new ALUF formula

Add it to `aluf_formulas` in `data-flow.yaml` and run `npm run build`. When
the formula contains `D` and the instruction has `IDBS,ARG`, the hover shows
the number in place of `D`.

### A new token

Add it to the token file of the variant. The generator gives it a colour
rule through its `category`. If it is `nd120_only: true`, it gets the
ND-120-only rule.

---

## 5. If something is wrong

**"I edited the YAML but nothing changed."**
Editing is not enough. Run `npm run build`. If VS Code runs the Extension Dev
Host, reload its window (`Ctrl+Shift+P`, "Developer: Reload Window"). If you
installed the `.vsix`, make a new one with `npm run package` and install it
again.

**"Hover does not work on my new token."**
The hover finds the word under the cursor with `TOKEN_CHAR_RE` in
`src/hoverProvider.ts`. A character that is not in that set (letters, digits
and `, + - * = _ # . $`) ends the word. Add the character there.

**"The runtime fact for my token is missing."**
Check the entry in `data-flow.yaml` (a wrong indent or a missing quote makes
it a different key). Then look at the generated file:

```bash
node -e 'const d = JSON.parse(require("fs").readFileSync("src/generated/token-hover.json")); console.log(d.runtime.commEffects["COMM,FOO"])'
```

---

## 6. Checking the generated data

```bash
# number of tokens in the hover file
node -e 'console.log(JSON.parse(require("fs").readFileSync("src/generated/token-hover.json")).tokenCount)'

# one token
node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync("src/generated/token-hover.json")).tokens["A,D"], null, 2))'

# the ND-120-only names
cat src/generated/nd120-only-tokens.json
```

The submodule has checks of the YAML itself. The library tests (vitest) are
in `external/meta/lib/ts/tests/` and run with `npm test` in
`external/meta/lib/ts`. The Python validator
`external/meta/tools/validate.py` disassembles a `.CODE` binary with the YAML
tokens and compares the result with the `.uc` source. By default it checks
the ND-110 RASK image in `external/meta/reference/`; `--model nd110|nd120`,
`--binary` and `--symbols` change what it checks. It needs PyYAML.

---

## 7. How the files relate

```
external/meta/defs/*.yaml            (edit here)
        |
        |  npm run generate
        v
src/generated/token-hover.json
src/generated/nd120-only-tokens.json
src/generated/definitions.json
syntaxes/uc.tmLanguage.json
        |
        |  npm run compile, npm run bundle
        v
out/extension.js                     (has the library inside)
        |
        |  npm run package
        v
nd-microcode.vsix
```
