# Source forms

How a `.uc` file is written differs between the machines. The extension
reads the file the way the variant says.

| | NORD-10 | ND-100/110/120 | ND-500 / ND-5000 |
|---|---|---|---|
| Comment | `%` | `%` | `%`, and `#` at the start of a line or after a space |
| End of instruction | end of line | `;` (the line that has a `;` ends the instruction) | `;`, the instruction may span lines |
| Address | `nnnn:` | `nnnn/` | `nnnn/` at the start of an instruction |
| Label | `NAME,` | `NAME:` | `NAME:` |
| Numbers | octal, `*n` | octal, `d` `0x` `$` `o` | octal, `n,n` long argument |
| Raw field | octal number | octal number | `FIELD=octal` |

The `%#MODEL` line is a comment (it starts with `%`) in every variant, so
it can stay in the file for any assembler.

For ND-100/110/120 the instruction normally has three lines: registers and
ALU, bus and sequencing, branch and condition. A short example, ND-110:

```
0/
% MASTER CLEAR / POWER CLEAR
        AB,MACL                                         ALUD,NONE
        IDBS,ARG               COMM,EWRF T,JMP         T,HOLD
        MACL;
```

The same file in the repository: `sample.uc`.

The mnemonics of each variant, with their bits, are on the pages under
[Variants](variants/index.md).
