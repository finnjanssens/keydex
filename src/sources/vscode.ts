import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { Shortcut } from "../types";
import { renderVSCodeKeys } from "../keys";
import { parseJsonc } from "../jsonc";

const CMD_PREFIX = [
  /^workbench\.files\.action\./,
  /^workbench\.action\./,
  /^editor\.action\./,
  /^workbench\./,
  /^editor\./,
];
function humanizeCommand(cmd: string): string {
  let c = cmd;
  for (const p of CMD_PREFIX)
    if (p.test(c)) {
      c = c.replace(p, "");
      break;
    }
  c = c
    .replace(/\./g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return c.charAt(0).toUpperCase() + c.slice(1);
}

// Curated common mac defaults ([rawKey, label]) — VSCode ships no readable
// defaults file, so this is a hand-picked subset merged with the user's file.
// ponytail: static subset, drifts across versions; extend as needed.
const VSCODE_DEFAULTS: [string, string][] = [
  ["cmd+shift+p", "Command palette"],
  ["cmd+p", "Go to file"],
  ["cmd+shift+o", "Go to symbol in file"],
  ["ctrl+g", "Go to line"],
  ["cmd+,", "Settings"],
  ["cmd+k cmd+s", "Keyboard shortcuts"],
  ["cmd+b", "Toggle sidebar"],
  ["cmd+j", "Toggle panel"],
  ["ctrl+`", "Toggle terminal"],
  ["cmd+shift+e", "Show explorer"],
  ["cmd+shift+f", "Search across files"],
  ["cmd+shift+g", "Source control"],
  ["cmd+shift+d", "Run and debug"],
  ["cmd+shift+x", "Extensions"],
  ["cmd+shift+m", "Problems panel"],
  ["cmd+n", "New file"],
  ["cmd+s", "Save"],
  ["cmd+shift+s", "Save as"],
  ["cmd+w", "Close editor"],
  ["cmd+shift+t", "Reopen closed editor"],
  ["cmd+\\", "Split editor"],
  ["cmd+1", "Focus 1st editor group"],
  ["cmd+2", "Focus 2nd editor group"],
  ["ctrl+tab", "Switch open editors"],
  ["cmd+f", "Find"],
  ["cmd+alt+f", "Replace"],
  ["cmd+g", "Find next"],
  ["cmd+d", "Add selection to next match"],
  ["cmd+shift+l", "Select all occurrences"],
  ["cmd+/", "Toggle line comment"],
  ["shift+alt+a", "Toggle block comment"],
  ["shift+alt+f", "Format document"],
  ["cmd+k cmd+f", "Format selection"],
  ["f2", "Rename symbol"],
  ["f12", "Go to definition"],
  ["alt+f12", "Peek definition"],
  ["shift+f12", "Find all references"],
  ["cmd+.", "Quick fix"],
  ["ctrl+space", "Trigger suggestions"],
  ["cmd+shift+k", "Delete line"],
  ["alt+up", "Move line up"],
  ["alt+down", "Move line down"],
  ["shift+alt+up", "Copy line up"],
  ["shift+alt+down", "Copy line down"],
  ["cmd+enter", "Insert line below"],
  ["cmd+shift+enter", "Insert line above"],
  ["cmd+]", "Indent line"],
  ["cmd+[", "Outdent line"],
  ["cmd+k z", "Zen mode"],
  ["cmd+k cmd+0", "Fold all"],
  ["cmd+k cmd+j", "Unfold all"],
];
// Cursor inherits VSCode's defaults and adds its AI bindings on top.
const CURSOR_DEFAULTS: [string, string][] = [
  ["cmd+k", "Inline edit (AI)"],
  ["cmd+l", "Open AI chat"],
  ["cmd+i", "Open Composer (Agent)"],
  ["tab", "Accept AI suggestion"],
];

type KB = { key?: string; command?: string };

// Merge curated defaults with the user's keybindings.json (their overrides win,
// `-command` removals hide a default). Key-level merge, not VSCode's full
// command+when resolution — good enough for a launcher.
function extract(
  source: string,
  appDir: string,
  defaults: [string, string][],
): Shortcut[] {
  const f = `${homedir()}/Library/Application Support/${appDir}/User/keybindings.json`;
  let user: KB[] = [];
  if (existsSync(f)) {
    try {
      const parsed = parseJsonc(readFileSync(f, "utf8"));
      if (Array.isArray(parsed)) user = parsed;
      else
        console.error(
          `${source}: keybindings.json isn't an array, showing defaults only`,
        );
    } catch (e) {
      console.error(
        `${source}: keybindings.json parse failed, showing defaults only`,
        e,
      );
    }
  }
  const overridden = new Set(
    user
      .filter(
        (e) =>
          e.key && typeof e.command === "string" && !e.command.startsWith("-"),
      )
      .map((e) => renderVSCodeKeys(e.key!)),
  );
  const removed = new Set(
    user
      .filter((e) => e.key && e.command?.startsWith("-"))
      .map((e) => renderVSCodeKeys(e.key!)),
  );

  const rows: Shortcut[] = [];
  for (const [rawKey, action] of defaults) {
    const keys = renderVSCodeKeys(rawKey);
    if (overridden.has(keys) || removed.has(keys)) continue;
    rows.push({ keys, action, source });
  }
  for (const e of user) {
    if (!e.key || typeof e.command !== "string" || e.command.startsWith("-"))
      continue;
    rows.push({
      keys: renderVSCodeKeys(e.key),
      action: humanizeCommand(e.command),
      source,
    });
  }
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = r.keys + "\0" + r.action;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}

export async function vscode(): Promise<Shortcut[]> {
  return extract("vscode", "Code", VSCODE_DEFAULTS);
}
export async function cursor(): Promise<Shortcut[]> {
  return extract("cursor", "Cursor", [...CURSOR_DEFAULTS, ...VSCODE_DEFAULTS]);
}
