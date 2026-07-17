# Shortcut Search (Raycast extension POC)

Spotlight-style fuzzy search across your apps' keyboard shortcuts, inside Raycast.
Auto-discovers them — no manual config.

## Run it

1. Install Raycast: https://raycast.com (or `brew install --cask raycast`)
2. In this folder:
   ```sh
   npm install
   npm run dev      # = ray develop; imports the extension into Raycast in dev mode
   ```
3. In Raycast, run **Search Shortcuts**. `npm run dev` hot-reloads on edits.

## How it works

### Layout

```
src/
  search-shortcuts.tsx   Raycast command (UI only): run sources → sort → render
  types.ts               Shortcut + Extractor types
  keys.ts                key-symbol rendering (renderChord / VSCode / Nvim)
  shell.ts               binary resolution + exec (loginPath, which, execAt)
  sources/
    ghostty.ts nvim.ts tmux.ts zsh.ts     one extractor each
    obsidian.ts vscode.ts zed.ts
    accessibility.ts       macOS menu bars of all other GUI apps (JXA + AX)
  jsonc.ts               string-aware JSONC parser (vscode + zed)
    index.ts             SOURCES registry (name + brand color + run)
```

Adding a tool = write `src/sources/<tool>.ts` exporting an `Extractor`, then add
one line to `SOURCES` in `src/sources/index.ts`. Nothing else changes.

Each extractor asks the tool to dump its *own* keybinds (robust) instead of
parsing config files (fragile). The command renders them in a Raycast `List` —
which provides the search box, fuzzy filtering, ranking, and keyboard nav for free.

- **ghostty** — `ghostty +list-keybinds`
- **nvim** — headless-loads your real config, dumps `vim.api.nvim_get_keymap()`
- **tmux** — `tmux list-keys` (prefix + root tables)
- **zsh** — `bindkey` (line-editor bindings; interactive shell)
- **obsidian** — curated defaults merged with each vault's `.obsidian/hotkeys.json`
  custom hotkeys (a custom binding on the same keys hides the default)
- **zed** — `~/.config/zed/keymap.json` (JSONC; user overrides only)
- **accessibility** — reads the live menu-bar shortcuts of every *other* running
  GUI app (Arc, Slack, Finder, Spotify, …) via the macOS Accessibility API (JXA +
  ObjC bridge, no native binary). Rows show the **real app icon** (`fileIcon` from
  the app's bundle path) and an app-name source tag (brand-colored for common apps).
  Requires Accessibility permission (see below); apps already covered above are
  skipped to avoid duplicates.
- **vscode / cursor** — a curated list of common mac defaults merged with your
  `~/Library/Application Support/{Code,Cursor}/User/keybindings.json`. Your
  overrides win over a default on the same key; `-command` removals hide the
  default. Cursor adds its AI bindings on top of the VSCode defaults. The default
  list is a hand-picked subset (not all ~200) and drifts across app versions.

The **action** is the list title (you search by what you want to do); the **keys**,
**mode**, and **source** show as accessories on the right. Enter copies the keys.

Cleanup applied to make results legible:

- **Key symbols** — `super+shift+c` / `<C-w>` → `⇧⌘C` / `⌃W`; `<leader>` is shown as
  its resolved key (Space → `␣`); arrows/page/etc → `← PgUp …`.
- **nvim noise filter** — drops built-in defaults whose description is a raw command
  (`:bprevious`, `<Plug>…`, `vim.lsp…`), keeping only human-described maps.
- **ghostty dedup + humanize** — collapses `digit_N`/`N` duplicates and logical
  aliases; `goto_tab:1` → "Go to tab 1", `copy_to_clipboard:mixed` → "Copy to clipboard".


## Known limits (POC)

- Binaries are resolved via your login shell (`$SHELL -lc "command -v …"`) so PATH
  matches your terminal; GUI apps not on PATH (ghostty) fall back to absolute paths
  in the `which(…, [fallbacks])` call. That login PATH is also handed to nvim so its
  plugin manager can find git/tools while loading your config.
- Extractor failures now surface as a Raycast toast + `console.error` (dev console),
  instead of silently showing nothing.
- nvim: global maps only; buffer-local maps (LSP-on-attach, filetype) don't show.
- **Accessibility source** needs permission: System Settings › Privacy & Security ›
  Accessibility → enable Raycast, then reopen. Without it that source shows a toast
  and no GUI-app rows. It reads *menu-bar* shortcuts only (not command-palette /
  in-app binds), from apps that are *running*, and re-walks menus on each open.
- No caching; extractors run on each open (nvim headless adds ~startup cost).
- Cosmetic: ghostty's `super++` renders as `⌘++` (a rare literal-`+` binding that
  duplicates `⌘=`). Not worth special-casing.
- `assets/extension-icon.png` is a 1×1 placeholder — swap for a real 512×512 icon.
