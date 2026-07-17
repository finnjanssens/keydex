import { Shortcut } from "../types";
import { renderTmuxKey } from "../keys";
import { which, execAt } from "../shell";

// `tmux list-keys` → `bind-key [-r] -T <table> <key> <command…>`.
// Keep the prefix + root tables (what you actually press); skip copy-mode.
// ponytail: prefix-table keys are pressed AFTER your prefix (default C-b);
// shown here as the bare key with a "prefix" tag rather than guessing it.
export async function tmux(path: string): Promise<Shortcut[]> {
  const bin = await which("tmux", path, [
    "/opt/homebrew/bin/tmux",
    "/usr/local/bin/tmux",
  ]);
  if (!bin) return [];
  let stdout: string;
  try {
    stdout = await execAt(bin, ["list-keys"], path);
  } catch {
    return []; // no server / no config
  }
  const out: Shortcut[] = [];
  for (const l of stdout.split("\n")) {
    const m = l.match(/-T\s+(\S+)\s+(\S+)\s+(.*)$/);
    if (!m) continue;
    const [, table, rawKey, cmd] = m;
    if (table !== "prefix" && table !== "root") continue;
    out.push({
      keys: renderTmuxKey(rawKey.replace(/^"|"$/g, "")),
      action: cmd.trim(),
      source: "tmux",
      mode: table,
    });
  }
  return out;
}
