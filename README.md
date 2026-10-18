# ND Microcode - VSCode Extension

Syntax highlighting, hover documentation, and assembly/disassembly
commands for microcode (`.uc`) files of six Norsk Data variants:
NORD-10, ND-100, ND-110, ND-120, ND-500 and ND-5000.

**Documentation:** <https://retrocorelabs.github.io/vs-extension-nd110-uc/>
(how to choose the variant, the commands and how to start them, the settings,
and the mnemonics of every variant).

Part of the [nd100uc toolchain](https://github.com/RetroCoreLabs/nd100uc).
Uses the shared [nd-microcode-meta](https://github.com/RetroCoreLabs/nd-microcode-meta)
submodule for token definitions and the TypeScript library.

## Features

- **Six variants.** NORD-10 (32-bit word), ND-100, ND-110, ND-120, ND-500
  (144-bit word) and ND-5000 (128-bit word). Token counts: 197 NORD-10,
  299 ND-100, 357 ND-110, 358 ND-120, 721 ND-500, 609 ND-5000. The tokens
  come from the YAML files of the submodule, which match the C# compiler
  tables.

- **Assemble and disassemble in the native format of each variant.** The
  TypeScript output equals the output of the C# compiler byte for byte on
  the reference images (tests in the submodule): NORD-10 `prom.hex`,
  ND-500 packed18 images, ND-5000 `.DATA` images, ND-1x0 `.CODE` files.

- **Colouring by variant.** Words get their colour from the token category;
  one colour table per family (ND-100/110/120 share one, ND-500/ND-5000
  share one, NORD-10 has its own). Octal numbers, `d123` `0x1F` `$1F`
  `o17` (ND-1x0), `n,n`, `*n`, labels and `FIELD=octal` are never marked as
  unknown. A word that is none of these is marked as unknown.

- **Hover documentation.** Hover any token to see its description,
  category and the bits of the variant of the file. Hover a number to see
  how it will be used.

- **Commands:**
  - Assemble current file (native image of its variant)
  - Assemble and split into ROM chip images (ND-110, ND-120)
  - Import an image (`.CODE`, `.DATA`, `.hex`) and disassemble
  - Show assembled bits for current instruction
  - Open live bit-breakdown view (side panel, any word width)
  - Set variant for this file
  - Check this file (assembler messages as editor marks; also done on save)

- **Variant status bar** at the right: `ND: ND-500 (%#MODEL)` shows the
  variant and how it was chosen.

## Choosing the variant

The variant of a file is the first of these that applies:

1. A `%#MODEL <name>` line in the first 50 lines of the file.
2. The setting `nd-microcode.fileModels`: file pattern -> variant.
3. A guess from the words in the file. The guess is shown in the status
   bar only; it is never written to the file or to a setting.
4. The setting `nd-microcode.defaultModel`.

Names: `nd10`, `nd100`, `nd110`, `nd120`, `nd120-dly`, `nd500`, `nd5000`.
Also accepted, in any case: `nord10`, `nd-10`, `nd-100`, `nd-110`,
`nd-120`, `nd120l`, `nd120-l`, `nd-500`, `nd-5000`. Typing `%#` in a `.uc`
file offers `MODEL`, and `%#MODEL ` offers the names.

Example `.vscode/settings.json`:

```json
{
  "nd-microcode.fileModels": {
    "*.nd500.uc": "nd500",
    "microcode/nord10/**/*.uc": "nd10",
    "microcode/delilah-l.uc": "nd120-dly"
  }
}
```

The command **ND Microcode: Set variant for this file** (also in the
status bar) writes either a `%#MODEL` line into the file or an entry into
the folder settings.

### nd120 and nd120-dly

`nd120` is the version K table (the C# `ND120Tokens`). `nd120-dly` is the
same table for version L microcode: the three register selects `B,P`,
`B,B` and `B,X` are assembled without the DLY1 bit (bit 27), as the C#
compiler does for version L.

| Token | nd120 (K), w2 | nd120-dly (L), w2 |
|-------|---------------|-------------------|
| `B,P` | `004002` | `000002` |
| `B,B` | `004003` | `000003` |
| `B,X` | `004007` | `000007` |

### Source forms

| | NORD-10 | ND-100/110/120 | ND-500 / ND-5000 |
|---|---|---|---|
| Comment | `%` | `%` | `%`, and `#` at line start or after a space |
| End of instruction | end of line | `;` (a line that has a `;` ends it) | `;`, may span lines |
| Address | `nnnn:` | `nnnn/` | `nnnn/` at the start of an instruction |
| Label | `NAME,` | `NAME:` | `NAME:` |
| Numbers | octal, `*n` | octal, `d` `0x` `$` `o` | octal, `n,n` long argument |
| Raw field | octal number | octal number | `FIELD=octal` |

## Install from source

```bash
git clone --recurse-submodules https://github.com/RetroCoreLabs/vs-extension-nd110-uc.git
cd vs-extension-nd110-uc

# Build the shared TS library (in the submodule)
cd external/meta/lib/ts && npm ci && npm run build && cd ../../../..

# Build the extension
npm install
npm run build

# Package
npm run package          # produces nd-microcode.vsix
code --install-extension nd-microcode.vsix
```

## Settings

| Key | Default | Description |
|-----|---------|-------------|
| `nd-microcode.hover.showEncoding` | `true` | Show raw octal encoding in hover |
| `nd-microcode.hover.showModelWarnings` | `true` | Highlight ND-120-only tokens |
| `nd-microcode.defaultModel` | `"nd110"` | Variant when nothing else decides (see "Choosing the variant") |
| `nd-microcode.fileModels` | `{}` | File pattern -> variant, relative to the workspace folder |
| `nd-microcode.autodetect.enabled` | `true` | Guess the variant from the words in the file |
| `nd-microcode.diagnostics.onSave` | `true` | Assemble on save and show the assembler messages |

## Repository layout

| Path                                    | Purpose                                                   |
|-----------------------------------------|-----------------------------------------------------------|
| `external/meta/`                        | Submodule: [nd-microcode-meta](https://github.com/RetroCoreLabs/nd-microcode-meta) |
| `external/meta/lib/ts/`                 | TypeScript library (`@nd100uc/microcode`)                 |
| `external/meta/defs/`                   | YAML token/field definitions (source of truth)            |
| `src/extension.ts`                      | Extension entry point                                     |
| `src/core/`                             | Logic without VS Code calls: variant rule, assemble/disassemble, colouring, bit fields |
| `src/hoverProvider.ts`                  | Token + numeric hover logic                               |
| `src/commands.ts`                       | VSCode command handlers                                   |
| `src/bitView.ts`                        | Side panel for the word breakdown                         |
| `src/modelResolver.ts`, `src/statusBar.ts`, `src/setModelCommand.ts`, `src/modelCompletion.ts` | Variant choice: settings, status bar, command, completion |
| `src/semanticTokens.ts`, `src/diagnostics.ts` | Colouring by variant, assembler messages            |
| `src/generated/`                        | Generated JSON (token-hover, definitions snapshot)        |
| `scripts/generate-hover-data.mjs`       | Generates hover JSON + TextMate grammar from YAML         |
| `scripts/snapshot-defs.mjs`             | Generates definitions snapshot from YAML                  |
| `syntaxes/uc.tmLanguage.json`           | TextMate grammar (generated)                              |

## Regenerating from YAML

When the YAML definitions in the submodule change:

```bash
npm run generate       # regenerate JSON + grammar from YAML
npm run build          # generate + compile + bundle
npm run package        # produce .vsix
```

See [`docs/generate-from-yaml.md`](docs/generate-from-yaml.md) for the
full pipeline documentation.

## Related repos

| Repo | Description |
|------|-------------|
| [nd100uc](https://github.com/RetroCoreLabs/nd100uc) | Web viewer, ROM combiners, build pipeline |
| [nd-microcode-meta](https://github.com/RetroCoreLabs/nd-microcode-meta) | Shared submodule: YAML definitions, TS library, reference ROMs |

## License

MIT - see [LICENSE](LICENSE).
