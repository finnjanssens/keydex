import { Shortcut } from "../types";
import { renderChord, isNamedKey } from "../keys";
import { which, execAt } from "../shell";

const DIRECTIONS = new Set(["left", "right", "up", "down", "top", "bottom"]);
function sentence(s: string): string {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// `goto_tab:1` → "Go to tab 1", `copy_to_clipboard:mixed` → "Copy to clipboard"
function humanize(action: string): string {
  const i = action.indexOf(":");
  const base = i === -1 ? action : action.slice(0, i);
  const arg = i === -1 ? "" : action.slice(i + 1);
  switch (base) {
    case "goto_tab":
      return `Go to tab ${arg}`;
    case "jump_to_prompt":
      return arg.startsWith("-")
        ? "Jump to previous prompt"
        : "Jump to next prompt";
    case "increase_font_size":
      return "Increase font size";
    case "decrease_font_size":
      return "Decrease font size";
    case "text":
      return "Send text";
    case "new_split":
    case "goto_split":
    case "resize_split":
    case "adjust_selection":
      return `${sentence(base)}${arg ? ` (${arg.replace(/_/g, " ")})` : ""}`;
  }
  // generic: keep only numeric/directional args, drop opaque ones (e.g. :mixed)
  const keepArg =
    arg && (DIRECTIONS.has(arg) || /^-?\d+$/.test(arg)) ? ` (${arg})` : "";
  return sentence(base) + keepArg;
}

// A trigger with no modifier, longer than one char, and not a named key is a
// ghostty "logical" binding (copy/paste) that duplicates a physical one — drop it.
function isLogicalTrigger(trigger: string): boolean {
  if (trigger.includes("+")) return false;
  const low = trigger.toLowerCase();
  return (
    trigger.length > 1 &&
    !isNamedKey(low) &&
    !low.startsWith("digit_") &&
    !/^f\d+$/.test(low)
  );
}

export async function ghostty(path: string): Promise<Shortcut[]> {
  const bin = await which("ghostty", path, [
    "/Applications/Ghostty.app/Contents/MacOS/ghostty",
    "/opt/homebrew/bin/ghostty",
  ]);
  if (!bin) return [];
  const stdout = await execAt(bin, ["+list-keybinds"], path);
  const seen = new Set<string>();
  const out: Shortcut[] = [];
  for (const l of stdout.split("\n")) {
    if (!l.startsWith("keybind = ")) continue;
    const body = l.slice("keybind = ".length);
    // Split on the LAST `=`: the trigger may contain a literal `=` key
    // (e.g. `super+==increase_font_size`), but actions never contain `=`.
    const i = body.lastIndexOf("=");
    const trigger = body.slice(0, i);
    if (isLogicalTrigger(trigger)) continue;
    const keys = renderChord(trigger);
    const action = humanize(body.slice(i + 1));
    const dedup = keys + "\0" + action;
    if (seen.has(dedup)) continue; // collapses digit_N / N duplicates
    seen.add(dedup);
    out.push({ keys, action, source: "ghostty" });
  }
  return out;
}
