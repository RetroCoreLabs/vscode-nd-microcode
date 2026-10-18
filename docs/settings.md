# Settings

All settings start with `nd-microcode.`.

## How to change them

- **Settings editor:** File > Preferences > Settings (`Ctrl+,`), then type `nd-microcode` in the search box.
- **JSON:** Command Palette, *Preferences: Open User Settings (JSON)* for all your projects, or *Preferences: Open Workspace Settings (JSON)* for the project in `.vscode/settings.json`.

Use the workspace file for `fileModels`, so the project carries its own
variants. The pattern of an entry is relative to the workspace folder.

## The list

| Setting | Default | What it does |
|---------|---------|--------------|
| `nd-microcode.defaultModel` | `"nd110"` | The variant when nothing else decides: no `%#MODEL` line, no matching `fileModels` entry, and the guess did not settle it. One of `nd10`, `nd100`, `nd110`, `nd120`, `nd120-dly`, `nd500`, `nd5000`. |
| `nd-microcode.fileModels` | `{}` | Variant per file. Key: file pattern, relative to the workspace folder. Value: variant name. The first matching entry wins. A `%#MODEL` line in the file wins over this setting. |
| `nd-microcode.autodetect.enabled` | `true` | Guess the variant from the words in the file when no line and no entry applies. The guess is only shown in the status bar. |
| `nd-microcode.diagnostics.onSave` | `true` | Assemble the file when it is saved, and show the assembler messages in the editor. |
| `nd-microcode.hover.showEncoding` | `true` | Show the bits of a word in the hover text. |
| `nd-microcode.hover.showModelWarnings` | `true` | Mark words that only the ND-120 has as `[ND-120 only]` in the hover text. |

How the first three work together is on the page
[Choosing the variant](choosing-the-variant.md), including the pattern rules
for `fileModels`.

## Example

`.vscode/settings.json` of a project with microcode for three machines:

```json
{
  "nd-microcode.defaultModel": "nd110",
  "nd-microcode.fileModels": {
    "*.nd500.uc": "nd500",
    "microcode/nord10/**/*.uc": "nd10",
    "microcode/delilah-l.uc": "nd120-dly"
  },
  "nd-microcode.diagnostics.onSave": true
}
```

## Settings of VS Code that matter

| Setting | Why |
|---------|-----|
| `editor.semanticHighlighting.enabled` | The extension turns this on for `.uc` files (`"[uc]"`). Colours by variant need it. |
| `editor.semanticTokenColorCustomizations` | Change the colour of a kind of word. See [Hover and colours](hover-and-colours.md#change-a-colour). |
