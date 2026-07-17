import { Shortcut } from "../types";
import { renderZshKeys } from "../keys";
import { which, execAt } from "../shell";

// Non-actionable widgets — noise for a shortcut list.
const SKIP = new Set(["self-insert", "undefined-key", "digit-argument"]);

function humanizeWidget(w: string): string {
  const s = w.replace(/^\./, "").replace(/-/g, " "); // strip leading `.` (builtin marker)
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function zsh(path: string): Promise<Shortcut[]> {
  const bin = await which("zsh", path, ["/bin/zsh"]);
  if (!bin) return [];
  let stdout: string;
  try {
    stdout = await execAt(bin, ["-ic", "bindkey"], path); // interactive → user's keymap
  } catch {
    return [];
  }
  const out: Shortcut[] = [];
  for (const l of stdout.split("\n")) {
    const m = l.match(/^"(.*)"\s+(\S+)$/);
    if (!m) continue;
    const [, seq, widget] = m;
    if (SKIP.has(widget)) continue;
    const keys = renderZshKeys(seq);
    if (!keys || keys.includes("[")) continue; // drop unmapped terminal escape codes
    out.push({ keys, action: humanizeWidget(widget), source: "zsh" });
  }
  return out;
}
