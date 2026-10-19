# Change Log

All notable changes to the `nd-microcode` VSCode extension.

## Unreleased

### Fixed

- ND-100: bits 22-27 of the PROM words are inverted (XOR `0x0FC00000`, the same
  as the ND-110; NORD-100 Microprogramming Description ND-06.018.01, "Writing the
  Microprogram"). The disassembler, the assembler and the bit view now flip them,
  so ND-100 `.CODE` files read and write in PROM form. Before, the ND-100 words
  were used as they come from the chips and almost every word showed a vectored
  jump with a loop counter. The ND-100 disassembly text no longer defines labels
  at addresses above 0o7777 (bit 20 is a timing bit on the ND-100).
- Metadata submodule: ND-100 mask corrected in the library, tools and
  documentation (earlier `0x01800000` and `0x0F800000`); the ND-120 images are
  documented as canonical, as the manual says.

## 0.2.1 - 2026-10-18

### Added

- Documentation site on GitHub Pages
  (https://retrocorelabs.github.io/nd-microcode/): how to choose the
  variant, the commands and how to start them, the settings, hover and colours,
  source forms, and one page per variant with every mnemonic, its bits and the
  YAML source.

### Changed

- Metadata submodule updated: corrected `token_count` headers of the ND-100 and
  ND-110 token files, README facts, validator accepts `T,REPEAT`.
- `docs/generate-from-yaml.md` rewritten for the six-variant layout.

## 0.2.0 - 2026-10-18

### Added

- **Six variants:** NORD-10, ND-100, ND-110, ND-120, ND-500 and ND-5000, with
  assemble and disassemble in the native format of each (tested against the
  C# compiler output in the submodule).
- **Variant choice:** `%#MODEL <name>` line, setting `nd-microcode.fileModels`,
  a guess from the words in the file, setting `nd-microcode.defaultModel`.
  Status bar item, command "Set variant for this file", completion for the
  `%#MODEL` line. Names are accepted in any case, with aliases (`nord10`,
  `nd-500`, ...).
- **Variant nd120-dly:** ND-120 version L register selects (`B,P`, `B,B`,
  `B,X` without the DLY1 bit).
- **Colouring by variant** (semantic tokens), one colour table per family;
  constants are never marked unknown.
- **Diagnostics:** assembler errors and warnings as editor marks (on save and
  with the command "Check this file").
- Bit view for any word width (32, 64, 128, 144 bits).
- Hover shows the bits of the variant of the file (the bits of a name can
  differ between ND-100, ND-110 and ND-120).

### Changed

- The ND-1x0 assembler ends an instruction at the line that has the `;`, as
  the C# compiler does (items after the `;` on that line belong to the
  instruction). Version K/L DELILAH sources now assemble to the C# output.
- The setting `nd-microcode.defaultModel` accepts all variants.

### Fixed

- ND-100 disassembly lost `T,NEXT` / `T,RETURN` on words with a vectored
  jump (1201 of 2048 words of the 3033S PROMs); now 2048 of 2048 round trip.

## 0.1.0 - 2026-04-16

Major upgrade: full ND-100/110/120 support with intelligent hover docs.

### Added

- **ND-120 support.** All 358 ND-120 tokens are recognised. The 12
  ND-120-only opcodes (`COMM,MACL`, `COMM,UART,*`, `IDBS,PICM`,
  `IDBS,UART`, `AB,BAUD`, `AB,OLD303`, `AB,NOISE`, `COMM,XSLOW`,
  `COMM,SLOW`) are tagged with a distinct TextMate scope
  (`keyword.other.nd120-only.uc`) so themes can highlight them.
- **Hover on tokens.** Every recognised token shows a Markdown
  tooltip with description, category, display line, model
  availability, operand requirements, and the raw octal encoding
  `(w4, w3, w2, w1)`.
- **Context-aware hover on numeric literals.** The extension walks
  the current instruction's tokens and explains what a numeric will
  be used for at runtime - a 13-bit branch target, 16-bit data for
  `IDBS,ARG` + `COMM,LDxxx`, LCC value in `SCOND=1` mode, etc.
- **YAML-driven pipeline.** Grammar and hover metadata are generated
  from the canonical YAML definitions at `defs/tokens/` in the parent
  repo via `npm run generate`. No more hand-maintained regex lists.
- Additional scopes for labels (`entity.name.function.label.uc`) and
  address markers (`entity.name.section.address.uc`) enable theming.
- **Commands (powered by `@nd100uc/microcode`):**
  - Assemble current .uc file -> .CODE
  - Assemble + split into HIGH/LOW chip images (32 KiB each)
  - Import a .CODE binary + .SYMBOLS.TXT -> new .uc document
  - Show assembled bits for current instruction (validation + decode)
  - Open live bit-breakdown view (side panel that refreshes as the
    cursor moves)
- Configuration: `nd-microcode.hover.showEncoding`,
  `nd-microcode.hover.showModelWarnings`,
  `nd-microcode.defaultModel`.

### Changed

- Extension identifier changed from `nd-110-microcode` to
  `nd-microcode` to reflect multi-model support.
- Display name updated to "ND-100/110/120 MicroCode".
- Grammar rewritten: every pattern is generated from YAML rather
  than maintained by hand, eliminating the drift observed against
  the reference C# tokens.

### Migration notes

If upgrading from 0.0.1, uninstall the old `nd-110-microcode`
extension before installing the new `nd-microcode` build.

---

## 0.0.1 - 2022-12-14

- Initial ND-110 syntax highlighter.
- Bugfix: `ALUF,O-A-1` validation was wrong, corrected to `ALUF,Q-A-1`.
