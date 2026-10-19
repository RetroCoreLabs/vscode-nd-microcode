# Commands

## How to start a command

There is no keyboard shortcut set by the extension. A command is started in
one of three ways:

1. **Command Palette.** Press `Ctrl+Shift+P` (`Cmd+Shift+P` on macOS) or `F1`, type `ND Microcode`, and pick the command. All commands are here.
2. **Right-click menu.** Right-click inside a `.uc` file. The first five commands in the table below are in the menu, in that order.
3. **Status bar.** Click the `ND: ...` item on the right to start **Set variant for this file**.

The extension starts when a `.uc` file is opened, or when one of its commands is started.

| Command in the palette | Right-click menu | Needs |
|------------------------|:----------------:|-------|
| ND Microcode: [Assemble current .uc file (native image of its variant)](#assemble-current-uc-file) | yes | a `.uc` file in the active editor |
| ND Microcode: [Assemble and split into ROM chip images](#assemble-and-split-into-rom-chip-images) | yes | a `.uc` file of ND-110, ND-120 or ND-120 (L) |
| ND Microcode: [Show assembled bits for current instruction](#show-assembled-bits-for-current-instruction) | yes | the cursor in an instruction |
| ND Microcode: [Open live bit-breakdown view](#open-live-bit-breakdown-view) | yes | |
| ND Microcode: [Set variant for this file](#set-variant-for-this-file) | yes | a `.uc` file in the active editor |
| ND Microcode: [Import binary image (.CODE / .DATA / .hex) and disassemble to .uc](#import-binary-image-and-disassemble-to-uc) | no | nothing |
| ND Microcode: [Check this file (show assembler messages)](#check-this-file) | no | a text editor |

The palette lists every command in every editor. A command that needs a
`.uc` file shows the message *Open a .uc microcode file to use this command.*
when the active editor is something else.

All commands use the variant of the file. See [Choosing the variant](choosing-the-variant.md).

## Assemble current .uc file

Command id: `vscode-nd-microcode.assembleCurrent`

Assembles the file in the active editor for its variant and writes the
image in the native format of that variant.

| Variant | Files written | Format |
|---------|---------------|--------|
| NORD-10 | `.hex` and `.CODE` | `prom.hex` text, and 32-bit big-endian words |
| ND-100, ND-110, ND-120, ND-120 (L) | `.CODE` | 10-byte records |
| ND-500 | `.CODE` | control store image, packed18 (18 bytes per word) |
| ND-5000 | `.DATA` | control store image, 16 bytes per word |

Steps:

1. The assembler messages are marked in the editor and listed in the Problems view and in the output channel **ND MicroCode** (View > Output).
2. If there are errors, a question appears: **Show errors**, **Write anyway**, or **Cancel**.
3. A save dialog proposes the name of the source file with the right ending, in the folder of the source file. For NORD-10 the second file gets the same name with `.CODE`. If the dialog is closed without a choice, the files are written to that proposed place.
4. A message tells how many words were assembled and what was written.

## Assemble and split into ROM chip images

Command id: `vscode-nd-microcode.assembleAndSplit`

For the two 32 KiB EPROM chips of the ND-110 and ND-120. Works for `nd110`,
`nd120` and `nd120-dly`. For any other variant, a message says that there is
no chip split.

Steps: assemble (a question appears if there are errors), pick an output
folder, and three files are written there, named after the source file:

| File | Content |
|------|---------|
| `<name>.CODE` | the whole image, 10-byte records |
| `<name>_HIGH.bin` | the high chip |
| `<name>_LOW.bin` | the low chip |

The message shows the size of a chip and the microcode version (letter and octal value) that was read from the image.

## Show assembled bits for current instruction

Command id: `vscode-nd-microcode.assembleLine`

With the cursor in an instruction, this prints a report in the output
channel **ND MicroCode** and shows the channel:

- the variant, the source line and the address of the instruction,
- the words (items) of the instruction,
- the word as a hex number, the storage form where that differs, and the parts in octal, most significant first,
- a table of the fields: name, bit range and value in octal,
- the validation result.

If the cursor is not in an instruction the message is *No instruction at cursor.*

## Open live bit-breakdown view

Command id: `vscode-nd-microcode.openBitView`

Opens a panel beside the editor, titled **ND MicroCode Bit View**. It shows
the instruction at the cursor as a grid of bits and a table of the named
fields with their values. It follows the cursor, and updates when the file is
edited or another `.uc` editor becomes active. The width of the grid follows
the variant (32, 64, 128 or 144 bits). The panel is empty when the active
editor is not a `.uc` file.

## Set variant for this file

Command id: `vscode-nd-microcode.setModel`

Asks for a variant and for where to keep the choice (a `%#MODEL` line in the
file, or the `vscode-nd-microcode.fileModels` setting). Also started by clicking
the status bar item. Details: [Choosing the variant](choosing-the-variant.md#set-the-variant).

## Import binary image and disassemble to .uc

Command id: `vscode-nd-microcode.disassembleBinary`

Reads an image file and opens its text as a new `.uc` document that starts
with a `%#MODEL` line. The new document is not saved; use **Save As** to keep it.

1. A file dialog asks for the image. Files shown by default: `.CODE`, `.code`, `.bin`, `.DATA`, `.data`, `.hex`. Any file can be picked.
2. The format is found from the file itself:

    | Found | Variant |
    |-------|---------|
    | 147456 bytes | ND-500, packed18 |
    | 262144 bytes | ND-5000 |
    | `prom.hex` text, or 32-bit big-endian words (4096 or 16384 bytes) | NORD-10 |
    | 10-byte records (`.CODE`) | ND-100, ND-110 or ND-120 |

3. A `.CODE` file does not say which of the ND-100/110/120 tables it uses, so a list asks: **Detect from the words** (ND-110 or ND-120 from the form of the words), `nd100`, `nd110`, `nd120` or `nd120-dly`.
4. Files with the same name in the same folder are read as well, if they exist:
   - `<name>.LABE`: labels for an ND-5000 image,
   - `<name>.SYMBOLS.TXT`: symbols for an ND-100/110/120 `.CODE` file.
5. A file of 32768 bytes (one 32 KiB EPROM chip) is refused with a message: both chips are needed, so combine them first.

The header lines of the new document say where it came from, the variant,
and the number of words.

## Check this file

Command id: `vscode-nd-microcode.checkFile`

Assembles the active file in memory and shows what the assembler says as
marks in the editor and entries in the Problems view (source `vscode-nd-microcode`).
Nothing is written to disk.

This also runs **each time a `.uc` file is saved**, unless
`vscode-nd-microcode.diagnostics.onSave` is turned off. Marks are removed when the
file is closed.

## Keyboard shortcuts

The extension sets none. To add your own, open **File > Preferences >
Keyboard Shortcuts**, search for `ND Microcode`, and bind a key to a
command. Or edit `keybindings.json` (Command Palette: *Preferences: Open
Keyboard Shortcuts (JSON)*):

```json
[
  { "key": "ctrl+alt+a", "command": "vscode-nd-microcode.assembleCurrent", "when": "editorLangId == uc" },
  { "key": "ctrl+alt+b", "command": "vscode-nd-microcode.openBitView",    "when": "editorLangId == uc" },
  { "key": "ctrl+alt+m", "command": "vscode-nd-microcode.setModel",       "when": "editorLangId == uc" }
]
```

The keys are only examples. Pick keys that are free in your setup.
