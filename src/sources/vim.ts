import { existsSync, readFileSync } from "node:fs";
import { Shortcut } from "../types";
import { execAt } from "../shell";
import { resolveNvim } from "./nvim";

// Built-in Vim motions/operators/text-objects aren't in nvim_get_keymap (they're
// hardcoded editor behavior). But Neovim ships the canonical index of them in
// its runtime docs — `$VIMRUNTIME/doc/index.txt` — so we parse that. It's shipped
// with the install, so this is auto-discovered (per-version), not a curated list.

// Only these sections carry the useful motions/operators/text-objects; the rest
// (insert-mode ctrl commands, command-line editing, ex commands) is noise.
const KEEP_SECTIONS: Record<string, string> = {
  Normal: "Normal",
  Visual: "Visual",
};
const SKIP_DESC = /not used|reserved|unmapped|not mapped/i;

function renderVimKey(k: string): string {
  return k
    .replace(/^\["[^\]]*\]/, "") // strip register prefix like ["x]
    .replace(/CTRL-(.)/g, (_, c) => "⌃" + c.toUpperCase());
}

function parseIndex(text: string): Shortcut[] {
  let mode: string | null = null;
  const seen = new Set<string>();
  const out: Shortcut[] = [];
  for (const line of text.split("\n")) {
    const header = line.match(
      /^\d+\.\s+(Insert|Normal|Visual|Command|Terminal|EX|Ex)/,
    );
    if (header) {
      mode = KEEP_SECTIONS[header[1]] ?? null;
      continue;
    }
    if (!mode) continue;
    const m = line.match(/^\|[^|]*\|\t+(.+)$/);
    if (!m) continue;
    const parts = m[1].split(/\t+/);
    if (parts.length < 2) continue;
    const keys = renderVimKey(parts[0].trim());
    // desc column may start with a note code ("1  ", "2  "); strip it.
    let desc = parts
      .slice(1)
      .join(" ")
      .replace(/^\d+\s+/, "")
      .trim();
    // Strip quotes wrapping the whole description (but keep meaningful inner
    // quotes like `same as "h"`).
    if (/^".*"$/.test(desc)) desc = desc.slice(1, -1).trim();
    // Drop entries with no real description (e.g. a lone `"` ditto mark).
    if (!keys || !/[a-z]/i.test(desc) || SKIP_DESC.test(desc)) continue;
    // Sentence-start capital; vim's meaningful casing (WORD, N) is left intact.
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
    const dedup = keys + "\0" + desc;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    out.push({ keys, action: desc, source: "vim", mode });
  }
  return out;
}

export async function vim(path: string): Promise<Shortcut[]> {
  const bin = await resolveNvim(path);
  if (!bin) return [];
  // --clean: skip config/plugins, we only need $VIMRUNTIME (fast).
  const runtime = (
    await execAt(
      bin,
      [
        "--clean",
        "--headless",
        "-c",
        "lua io.write(vim.env.VIMRUNTIME)",
        "-c",
        "qa!",
      ],
      path,
    )
  ).trim();
  if (!runtime) return [];
  const file = `${runtime}/doc/index.txt`;
  if (!existsSync(file)) return [];
  return parseIndex(readFileSync(file, "utf8"));
}
