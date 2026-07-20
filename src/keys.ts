// Key normalization: turn tool-specific notation into macOS symbols.

const MOD: Record<string, string> = {
  super: "⌘",
  cmd: "⌘",
  command: "⌘",
  meta: "⌘",
  ctrl: "⌃",
  control: "⌃",
  alt: "⌥",
  opt: "⌥",
  option: "⌥",
  shift: "⇧",
};
const MOD_RANK: Record<string, number> = {
  ctrl: 0,
  control: 0,
  alt: 1,
  opt: 1,
  option: 1,
  shift: 2,
  super: 3,
  cmd: 3,
  command: 3,
  meta: 3,
};
const KEY: Record<string, string> = {
  arrow_left: "←",
  arrow_right: "→",
  arrow_up: "↑",
  arrow_down: "↓",
  left: "←",
  right: "→",
  up: "↑",
  down: "↓",
  page_up: "PgUp",
  page_down: "PgDn",
  pageup: "PgUp",
  pagedown: "PgDn",
  home: "Home",
  end: "End",
  enter: "↩",
  cr: "↩",
  return: "↩",
  tab: "⇥",
  space: "␣",
  backspace: "⌫",
  bs: "⌫",
  delete: "⌦",
  del: "⌦",
  escape: "⎋",
  esc: "⎋",
};

function renderKeyToken(t: string): string {
  if (t === "") return "+"; // ghostty splits `super++` into an empty token
  if (t.startsWith("digit_")) return t.slice(6);
  const low = t.toLowerCase();
  return KEY[low] ?? (t.length === 1 ? t.toUpperCase() : t);
}

/** True for keys with a named symbol (arrows, page, home/end, tab…). */
export function isNamedKey(token: string): boolean {
  return token.toLowerCase() in KEY;
}

// One chord with a given token separator (`+` for ghostty/VSCode, `-` for Zed).
function renderChordSep(chord: string, sep: string): string {
  const tokens = chord.split(sep);
  const mods = tokens
    .filter((t) => t.toLowerCase() in MOD)
    .sort((a, b) => MOD_RANK[a.toLowerCase()] - MOD_RANK[b.toLowerCase()]);
  const rest = tokens.filter((t) => !(t.toLowerCase() in MOD));
  return (
    mods.map((m) => MOD[m.toLowerCase()]).join("") +
    rest.map(renderKeyToken).join("")
  );
}

/** One chord like `super+shift+c` / `cmd+shift+p` → `⇧⌘C` (canonical mod order). */
export function renderChord(chord: string): string {
  return renderChordSep(chord, "+");
}

/** Space-separated chord sequence (VSCode/Cursor), e.g. `cmd+k cmd+f` → `⌘K ⌘F`. */
export function renderVSCodeKeys(key: string): string {
  return key
    .split(" ")
    .map((c) => renderChordSep(c, "+"))
    .join(" ");
}

/** Zed keys use `-` within a chord, space between chords: `cmd-k cmd-f` → `⌘K ⌘F`. */
export function renderZedKeys(key: string): string {
  return key
    .split(" ")
    .map((c) => renderChordSep(c, "-"))
    .join(" ");
}

// tmux key notation: `C-b` → ⌃B, `M-Up` → ⌥↑, `c` → C.
const TMUX_MOD: Record<string, string> = { C: "⌃", M: "⌥", S: "⇧" };
export function renderTmuxKey(t: string): string {
  const m = t.match(/^((?:[CMS]-)+)?(.+)$/);
  if (!m) return t;
  const mods = (m[1] ?? "").match(/[CMS]/g) ?? [];
  return mods.map((x) => TMUX_MOD[x]).join("") + renderKeyToken(m[2]);
}

// Obsidian hotkeys.json: modifiers array (Mod=⌘ on mac) + key.
const OBS_MOD: Record<string, string> = {
  Mod: "⌘",
  Meta: "⌘",
  Ctrl: "⌃",
  Alt: "⌥",
  Shift: "⇧",
};
const OBS_RANK: Record<string, number> = {
  Ctrl: 0,
  Alt: 1,
  Shift: 2,
  Mod: 3,
  Meta: 3,
};
export function renderObsidianKeys(modifiers: string[], key: string): string {
  const ordered = [...modifiers].sort(
    (a, b) => (OBS_RANK[a] ?? 9) - (OBS_RANK[b] ?? 9),
  );
  return ordered.map((m) => OBS_MOD[m] ?? m).join("") + renderKeyToken(key);
}

// zsh bindkey caret notation: `^A` → ⌃A, `^X^E` → ⌃X⌃E, `^[b` → ⌥b, CSI → arrows.
const ZSH_CSI: Record<string, string> = {
  "^[[A": "↑",
  "^[[B": "↓",
  "^[[C": "→",
  "^[[D": "←",
  "^[OA": "↑",
  "^[OB": "↓",
  "^[OC": "→",
  "^[OD": "←",
  "^[[H": "Home",
  "^[[F": "End",
  "^[[5~": "PgUp",
  "^[[6~": "PgDn",
  "^[[3~": "⌦",
  "^[[2~": "Ins",
};
export function renderZshKeys(seq: string): string {
  if (ZSH_CSI[seq]) return ZSH_CSI[seq];
  let out = "";
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === "^" && seq[i + 1] === "[") {
      out += "⌥";
      i++;
      continue;
    } // meta
    if (seq[i] === "^") {
      out += "⌃" + (seq[i + 1] ?? "").toUpperCase();
      i++;
      continue;
    }
    out += seq[i];
  }
  return out;
}

// Angle-bracket tokens: `<C-w>` → ⌃W, `<Tab>` → ⇥, `<Down>` → ↓, etc.
// Shared by nvim (keymaps) and vim (index.txt built-ins).
const NVIM_MOD: Record<string, string> = {
  C: "⌃",
  M: "⌥",
  A: "⌥",
  S: "⇧",
  D: "⌘",
};
export function renderAngleTokens(s: string): string {
  return s
    .replace(
      /<([CMASD])-([^>]+)>/g,
      (_, mod, inner) => NVIM_MOD[mod] + renderKeyToken(inner),
    )
    .replace(/<([^>]+)>/g, (_, k) => renderKeyToken(k));
}
export function renderNvimKeys(lhs: string): string {
  // <leader> is already resolved to its literal key (e.g. Space) in the lhs.
  return renderAngleTokens(lhs).replace(/ /g, "␣");
}
