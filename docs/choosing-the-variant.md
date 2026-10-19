# Choosing the variant

The extension supports seven variant names. Each file uses exactly one.

| Name | Machine |
|------|---------|
| `nd10` | NORD-10 |
| `nd100` | ND-100 |
| `nd110` | ND-110 |
| `nd120` | ND-120, version K |
| `nd120-dly` | ND-120, version L |
| `nd500` | ND-500 |
| `nd5000` | ND-5000 |

The pages under [Variants](variants/index.md) list the mnemonics of each one.

## The rule

The variant of a file is the **first** of these that applies:

1. **A `%#MODEL <name>` line** in the first 50 lines of the file.
2. **The setting `vscode-nd-microcode.fileModels`:** a list of file patterns, each with a variant.
3. **A guess from the words in the file.** The guess is only shown in the status bar. It is never written to the file or to a setting.
4. **The setting `vscode-nd-microcode.defaultModel`** (`nd110` until you change it).

Rule 1 beats rule 2, rule 2 beats rule 3, rule 3 beats rule 4. The guess
(rule 3) can be switched off with `vscode-nd-microcode.autodetect.enabled`.

## See which variant is in use

Open a `.uc` file. The status bar item on the right shows the variant and
the rule that decided:

| Status bar text | Meaning |
|-----------------|---------|
| `ND: ND-500 (%#MODEL)` | Rule 1: a `%#MODEL` line |
| `ND: ND-500 (settings *.nd500.uc)` | Rule 2: this entry of `fileModels` matched |
| `ND: ND-500 (autodetect 0.95)` | Rule 3: the guess, with its score |
| `ND: ND-110 (default)` | Rule 4: `defaultModel`. Nothing else decided |
| `ND: ND-110 (default (...))` | Rule 4, and the text in the inner brackets says why the guess did not decide |

Hold the mouse over the item to read the rule and a short description of
the variant. If the item is yellow, there is a problem (for example an
unknown name in the `%#MODEL` line); the hover text names it.

## Set the variant

### The command

Click the status bar item, or run **ND Microcode: Set variant for this file**
from the Command Palette or the right-click menu. Two lists follow:

1. The variant. The current one is marked.
2. Where to keep the choice:
   - **Write a `%#MODEL` line into this file.** The line goes at the top of the
      file, or replaces the `%#MODEL` line that is already there. It goes with the file.
   - **Store in the folder settings.** An entry for this file is added to
      `vscode-nd-microcode.fileModels` in the `.vscode/settings.json` of the workspace
      folder. The file itself is not changed. A file that is not inside a
      workspace folder cannot use this; the extension tells you to write the line.

### The `%#MODEL` line

Write the line by hand, in the first 50 lines:

```
%#MODEL nd500
```

It starts with `%`, which is a comment in every variant, so the assemblers
ignore it. Typing `%#` offers `MODEL`; after `%#MODEL ` the list of names
is offered, with the word size of each.

The name is not case sensitive. These spellings are accepted:

| Variant | Accepted spellings |
|---------|--------------------|
| NORD-10 | `nd10`, `nord10`, `nord-10`, `nd-10` |
| ND-100 | `nd100`, `nd-100` |
| ND-110 | `nd110`, `nd-110` |
| ND-120 | `nd120`, `nd-120` |
| ND-120 version L | `nd120-dly`, `nd-120-dly`, `nd120l`, `nd120-l`, `nd-120-l` |
| ND-500 | `nd500`, `nd-500` |
| ND-5000 | `nd5000`, `nd-5000` |

A name that is not in the list is reported in the status bar, and the
extension goes on to rule 2.

### The setting

`vscode-nd-microcode.fileModels` maps file patterns to variants. Put it in
`.vscode/settings.json` of the workspace to share it with the project:

```json
{
  "vscode-nd-microcode.fileModels": {
    "*.nd500.uc": "nd500",
    "microcode/nord10/**/*.uc": "nd10",
    "microcode/delilah-l.uc": "nd120-dly"
  }
}
```

How the patterns work:

- A pattern is matched against the path of the file **relative to the workspace folder**, with `/` between folders.
- A pattern **without** a `/` is matched against the file name only (`*.nd500.uc`).
- A pattern **with** a `/` is matched against the whole relative path.
- `*` is any text inside one folder name, `**` is any text across folders, `?` is one character, `{a,b}` is a choice between texts.
- Case does not matter.
- The **first** matching entry, in the order of the setting, wins.

## The guess

If no `%#MODEL` line and no `fileModels` entry applies, the extension looks
at the words in the file. It ignores comments, labels, addresses and numbers
and counts how many of the remaining words are mnemonics of each variant.

- A file with no `;` outside comments can only be guessed as NORD-10. A file with a `;` is never guessed as NORD-10.
- The best group of variants (NORD-10, ND-100/110/120, ND-500, ND-5000) must have at least 60 % of the words as its mnemonics, and must be at least 10 percentage points ahead of the next group.
- Inside ND-100/110/120, the variant that knows the most of the words wins. If two know the same number, the guess stays open.
- The guess never picks `nd120-dly`. Version L files need a `%#MODEL` line or a `fileModels` entry.

When the guess stays open, rule 4 decides, and the status bar tells why
(`default (...)`). A short file with few mnemonics often stays open. Write
a `%#MODEL` line for it.

## ND-120 and ND-120 version L

`nd120` is the version K table. `nd120-dly` is the same table for version L
microcode: the three register selects `B,P`, `B,B` and `B,X` are assembled
without the DLY1 bit (bit 27). The words that differ are listed on the
[ND-120 version L](variants/nd120-dly.md) page.
