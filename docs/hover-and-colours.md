# Hover and colours

Both follow the variant of the file. Change the variant and the colours and
the hover text change with it. See [Choosing the variant](choosing-the-variant.md).

## Hover

Hold the mouse over a word.

**A mnemonic of the variant** shows:

- the name, and the variants that have it (for ND-100/110/120: `[ND-100 + ND-110 + ND-120]`; for words that only the ND-120 has: `[ND-120 only]`; for NORD-10, ND-500, ND-5000: the variant),
- the description from the definitions,
- the category, and for ND-100/110/120 the line of the instruction it belongs to (line 1 registers and ALU, line 2 bus, command and true-path sequencing, line 3 branch and condition),
- for ND-100/110/120, what the word `provides` and `requires`,
- for NORD-10, ND-500 and ND-5000, what the word stands for: a field and value, a memory operation code, or the category,
- the **bits** the word sets, as octal numbers in 16-bit groups, most significant group first. For `nd120-dly` the bits are those of version L.

**A number** shows what it is:

- ND-100/110/120: the value in octal, decimal and hex, and what it is used for, found from the other words of the same instruction (for example a branch target, a value loaded into a register, or a loop counter compare).
- NORD-10: an octal constant that is ORed into the micro word as it is.
- ND-500 and ND-5000: a short argument goes to bits 15-0; a long argument `n,n` puts the first number in bits 31-16 and the second in bits 15-0.

**A word of another variant.** If the word is not a mnemonic of the variant
of the file but is one of another variant, the hover text says so and names
the variants that have it.

Two settings change the hover text, see [Settings](settings.md):
`vscode-nd-microcode.hover.showEncoding` and `vscode-nd-microcode.hover.showModelWarnings`.

For a view of the bits of a whole instruction, use the
[bit view](commands.md#open-live-bit-breakdown-view).

## Colours

Colours come from semantic highlighting, which the extension turns on for
`.uc` files. If you turn it off, a simpler colouring from the TextMate
grammar is used instead.

Each word gets the kind of its category. There is one table per group of
variants, so the same kind of word has the same colour in every variant of
the group: ND-100, ND-110 and ND-120 share one table, ND-500 and ND-5000
share one, and NORD-10 has its own.

ND-100, ND-110 and ND-120:

| Category | Kind (token type) |
|----------|-------------------|
| `A_REG`, `B_REG`, `AB_REG`, `PIC` | `variable` |
| `ALUF`, `ALUD`, `ALUM`, `STS`, `CRY`, `MIS` | `type` |
| `IDBS` | `parameter` |
| `COMM` | `keyword` |
| `T_SEQ`, `T_STK`, `F_SEQ`, `F_STK` | `enumMember` |
| `COND` | `operator` |
| `SPECIAL` | `macro` |

Other words:

| Word | Kind |
|------|------|
| Comment (`%`, and `#` at the start of a line or after a space in ND-500 and ND-5000) | `comment` |
| Number, address (`nnnn/`) | `number` |
| Label (definition or use) | `function` |
| `FIELD=octal` with a known field (ND-500, ND-5000) | `macro` |
| A word that is none of the above | `ucUnknown` |

Numbers are never marked as unknown. The forms that count as numbers depend
on the variant: octal in all of them; `d123`, `0x1F`, `$1F` and `o17` in
ND-100/110/120; `*n` in NORD-10; a trailing `B` and `n,n` in ND-500 and ND-5000.

The kind decides the colour through your colour theme, so the colours differ
from theme to theme. `ucUnknown` falls back to the theme colour of
`invalid.illegal`.

### Change a colour

In `settings.json`:

```json
{
  "editor.semanticTokenColorCustomizations": {
    "[*]": {
      "rules": {
        "ucUnknown": "#ff5555",
        "keyword:uc": { "foreground": "#c586c0", "bold": true }
      }
    }
  }
}
```

The names on the left are the token types in the tables above.
