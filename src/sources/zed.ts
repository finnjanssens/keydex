import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { Shortcut } from "../types";
import { renderZedKeys } from "../keys";
import { parseJsonc } from "../jsonc";

type Block = { bindings?: Record<string, string | [string, unknown] | null> };

// "editor::SelectAll" → "Select all"
function humanize(action: string): string {
  const base = action.split("::").pop() ?? action;
  const spaced = base.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

// Zed keymap.json (JSONC): array of { context, bindings: { keystroke: action } }.
// User overrides only; Zed's defaults live in the app, not on disk.
export async function zed(): Promise<Shortcut[]> {
  const f = `${homedir()}/.config/zed/keymap.json`;
  if (!existsSync(f)) return [];
  let blocks: Block[];
  try {
    const parsed = parseJsonc(readFileSync(f, "utf8"));
    blocks = Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
  const out: Shortcut[] = [];
  for (const block of blocks) {
    for (const [keystroke, action] of Object.entries(block.bindings ?? {})) {
      if (!action) continue; // null unbinds a default
      const name = Array.isArray(action) ? action[0] : action;
      out.push({
        keys: renderZedKeys(keystroke),
        action: humanize(name),
        source: "zed",
      });
    }
  }
  return out;
}
