import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { Shortcut } from "../types";
import { renderObsidianKeys } from "../keys";

type Hotkey = { modifiers?: string[]; key?: string };

// Curated common mac defaults ([prettyKeys, label]) — Obsidian ships no readable
// defaults file (they live in the app). ponytail: static subset, may drift.
const DEFAULTS: [string, string][] = [
  ["⌘P", "Command palette"],
  ["⌘O", "Quick switcher"],
  ["⌘G", "Graph view"],
  ["⌘,", "Settings"],
  ["⌘N", "New note"],
  ["⌘W", "Close tab"],
  ["⌘E", "Toggle edit/reading view"],
  ["⌘F", "Search current file"],
  ["⌘H", "Search and replace"],
  ["⇧⌘F", "Search all files"],
  ["⌘B", "Toggle bold"],
  ["⌘I", "Toggle italic"],
  ["⌘K", "Insert link"],
  ["⌘D", "Delete paragraph"],
  ["⌘S", "Save file"],
  ["⌥⌘←", "Navigate back"],
  ["⌥⌘→", "Navigate forward"],
  ["⌥↩", "Follow link under cursor"],
  ["⌥⌘↩", "Open link in new tab"],
  ["F1", "Open help"],
];

// command id → human label: "editor:toggle-bold" → "Toggle bold".
function humanize(cmd: string): string {
  const last = cmd.includes(":") ? cmd.slice(cmd.indexOf(":") + 1) : cmd;
  const s = last.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Obsidian stores only *custom* hotkeys in each vault's .obsidian/hotkeys.json.
// Vaults are listed in obsidian.json. We merge those over the curated defaults;
// a custom binding on the same keys hides the matching default (key-level merge).
export async function obsidian(): Promise<Shortcut[]> {
  const cfg = `${homedir()}/Library/Application Support/obsidian/obsidian.json`;
  if (!existsSync(cfg) && !existsSync("/Applications/Obsidian.app")) return [];

  const userRows: Shortcut[] = [];
  let vaults: Record<string, { path: string }> = {};
  if (existsSync(cfg)) {
    try {
      vaults = JSON.parse(readFileSync(cfg, "utf8")).vaults ?? {};
    } catch {
      /* keep defaults */
    }
  }
  for (const { path } of Object.values(vaults)) {
    const hk = `${path}/.obsidian/hotkeys.json`;
    if (!existsSync(hk)) continue;
    let map: Record<string, Hotkey[]>;
    try {
      map = JSON.parse(readFileSync(hk, "utf8"));
    } catch {
      continue;
    }
    for (const [cmd, binds] of Object.entries(map)) {
      for (const b of binds) {
        userRows.push({
          keys: renderObsidianKeys(b.modifiers ?? [], b.key ?? ""),
          action: humanize(cmd),
          source: "obsidian",
        });
      }
    }
  }

  const userKeys = new Set(userRows.map((r) => r.keys));
  const rows: Shortcut[] = [
    ...DEFAULTS.filter(([keys]) => !userKeys.has(keys)).map(
      ([keys, action]) => ({ keys, action, source: "obsidian" }),
    ),
    ...userRows,
  ];
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = r.keys + "\0" + r.action;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}
