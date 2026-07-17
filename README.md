# Keydex

An index of every keyboard shortcut across your apps — a [Raycast](https://raycast.com)
extension that **auto-discovers** your keybinds from your actual configs and running
apps, then lets you search them by what they do.

Stop guessing whether it was `⌘K`, `<leader>ff`, or a menu item three levels deep.
Open Raycast, type what you want ("find files", "toggle sidebar"), and Keydex shows
the key — across your terminal, editors, and GUI apps at once.

## Features

- **Search by intent** — type what a shortcut *does*; the key combo is the answer.
- **Auto-discovered** — reads each tool's own keybinds (not hand-maintained lists),
  so it reflects *your* config, including customizations.
- **One place for everything** — terminal tools, editors, and every running GUI app.
- **Readable** — keys render as macOS symbols (`⇧⌘C`, `⌃W`, `⌘K ⌘F`), results show
  each source's real app icon, and noise is filtered out.
- **Fast** — results are cached, so reopening is instant.

## Supported sources

| Source | How it's discovered |
| --- | --- |
| **ghostty** | `ghostty +list-keybinds` |
| **nvim** | headless-loads your config, dumps `vim.api.nvim_get_keymap()` |
| **tmux** | `tmux list-keys` (prefix + root tables) |
| **zsh** | `bindkey` (line-editor bindings) |
| **vscode / cursor** | curated mac defaults merged with your `keybindings.json` |
| **zed** | `~/.config/zed/keymap.json` |
| **obsidian** | curated defaults merged with each vault's `hotkeys.json` |
| **any GUI app** | live menu-bar shortcuts via the macOS Accessibility API (Arc, Slack, Finder, Spotify, …) |

For editor/app sources, your own overrides win over the bundled defaults, and
removals hide them. Terminal tools and configs are read live, so they always
match your setup.

## Install

Not yet on the Raycast Store. To run it locally:

```sh
git clone git@github.com:finnjanssens/keydex.git
cd keydex
npm install
npm run dev   # imports the extension into Raycast in dev mode
```

Then open Raycast and run **Search Shortcuts**.

## Accessibility permission

The GUI-app source reads menu bars through the macOS Accessibility API. Grant it in
**System Settings › Privacy & Security › Accessibility** → enable **Raycast**, then
reopen the command. It reads *menu-bar* shortcuts only, from apps that are currently
running. You can turn this source off in the command's preferences.

## How it works

Each source is a small **extractor** that asks the tool to dump its own keybinds
(robust) rather than parsing config files (fragile), returning a normalized
`{ keys, action, source }`. The command runs them in parallel, merges, sorts, and
renders them in a Raycast `List` — which provides search, fuzzy filtering, and
keyboard nav for free.

```
src/
  search-shortcuts.tsx   command UI: run sources → cache → render
  types.ts               Shortcut + Extractor types
  keys.ts                key-symbol rendering (chords, VSCode, Zed, nvim, tmux, …)
  shell.ts               binary resolution + exec (loginPath, which, execAt)
  jsonc.ts               string-aware JSONC parser (vscode + zed)
  sources/
    ghostty.ts nvim.ts tmux.ts zsh.ts
    vscode.ts zed.ts obsidian.ts
    accessibility.ts     macOS menu bars of all other GUI apps (JXA + AX bridge)
    index.ts             SOURCES registry (name, brand color, icon, extractor)
```

**Adding a source** = write `src/sources/<tool>.ts` exporting an `Extractor`, then
add one line to `SOURCES` in `src/sources/index.ts`.

Notable details:

- Binaries resolve via your login shell (`$SHELL -lc`), so `PATH` matches your
  terminal; GUI apps not on `PATH` (ghostty) fall back to absolute paths. nvim also
  gets that `PATH` so its plugin manager can load your config.
- The Accessibility reader uses JXA + the ObjC bridge (no compiled binary), decoding
  Carbon menu modifier/glyph codes into macOS symbols.
- Extractor failures surface as a toast + `console.error`, never a silent blank list.

## Notes & limits

- **nvim**: global maps only; buffer-local maps (LSP-on-attach, filetype) aren't shown.
- **Accessibility**: menu-bar shortcuts only (not command-palette / in-app binds),
  from running apps.
- **vscode / cursor / obsidian defaults** are a curated subset and may drift across
  app versions; your own bindings are always read live.

## License

MIT © Finn Janssens
