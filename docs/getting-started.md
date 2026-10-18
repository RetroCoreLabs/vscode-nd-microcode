# Getting started

## Install

1. Download `nd-microcode-<version>.vsix` from the
   [Releases page](https://github.com/RetroCoreLabs/vs-extension-nd110-uc/releases).
2. Install it in VS Code, either way:
   - Extensions view, the `...` menu at the top, **Install from VSIX...**, pick the file.
   - Terminal: `code --install-extension nd-microcode-<version>.vsix`

VS Code 1.73 or newer is needed. To build the `.vsix` yourself, see
[Install from source](../README.md#install-from-source).

## Open a microcode file

The extension handles files that end in `.uc`. When one is opened, the
extension starts and you get:

- **Colours.** Words get a colour from their kind (register, ALU function,
  sequencing, number, label, comment). A word that the variant of the file
  does not know is marked as unknown. See [Hover and colours](hover-and-colours.md).
- **Hover text.** Hold the mouse over a word to see what it means and which
  bits it sets. See [Hover and colours](hover-and-colours.md).
- **A status bar item on the right,** for example `ND: ND-110 (default)`.
  It names the variant the extension uses for this file and how it was
  chosen. Click it to change the variant. See [Choosing the variant](choosing-the-variant.md).
- **Red and yellow marks** for what the assembler finds wrong. The file is
  checked each time it is saved. See [Commands](commands.md#check-this-file).
- **Commands** to assemble, split into ROM chip images, disassemble an
  image, and show the bits of one instruction. See [Commands](commands.md).

## First steps

1. Open your `.uc` file and look at the status bar. If the variant is wrong,
   click the status bar item and pick the right one, and let the extension
   write a `%#MODEL` line at the top of the file. That line is read first and
   goes with the file.
2. Hold the mouse over a few words to read their meaning.
3. Right-click in the file. The menu has the ND Microcode commands. Try
   **Show assembled bits for current instruction** with the cursor in an
   instruction.
4. Run **ND Microcode: Assemble current .uc file** from the Command Palette
   (`Ctrl+Shift+P`; `Cmd+Shift+P` on macOS) to write the image file.

The repository has a small file to try everything on:
[`sample.uc`](https://github.com/RetroCoreLabs/vs-extension-nd110-uc/blob/main/sample.uc)
(ND-110 microcode).

## Where to read next

| Question | Page |
|----------|------|
| Which variant does a file use, and how do I set it? | [Choosing the variant](choosing-the-variant.md) |
| What commands are there and how do I start them? | [Commands](commands.md) |
| What can I configure? | [Settings](settings.md) |
| How is a source file written for each variant? | [Source forms](source-forms.md) |
| What mnemonics does each variant have? | [Variants](variants/index.md) |
