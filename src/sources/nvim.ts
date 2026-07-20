import { dirname } from "node:path";
import { Shortcut } from "../types";
import { renderNvimKeys } from "../keys";
import { which, execAt, USER } from "../shell";

const MODE: Record<string, string> = {
  n: "Normal",
  i: "Insert",
  v: "Visual",
  x: "Visual",
  s: "Select",
  o: "Operator",
  t: "Terminal",
  c: "Command",
};

// Shared so the vim built-ins source can locate nvim too.
export function resolveNvim(path: string): Promise<string | null> {
  return which("nvim", path, [
    `/etc/profiles/per-user/${USER}/bin/nvim`,
    `/Users/${USER}/.nix-profile/bin/nvim`,
    "/run/current-system/sw/bin/nvim",
    "/opt/homebrew/bin/nvim",
    "/usr/local/bin/nvim",
  ]);
}

export async function nvim(path: string): Promise<Shortcut[]> {
  const bin = await resolveNvim(path);
  if (!bin) return [];
  // nvim's own dir on PATH so its plugin manager finds git/tools loading config.
  const nvimPath = `${dirname(bin)}:${path}`;
  // Only emit maps with a real description — drops built-in noise whose
  // "description" was just the raw rhs (:brewind, <Plug>…). Emit mode separately
  // as tab-separated `lhs \t mode \t desc`.
  // ponytail: global maps only; buffer-local (LSP/filetype) maps won't appear.
  const lua = `
    for _, mode in ipairs({ "n", "i", "v", "x", "s", "o", "t", "c" }) do
      for _, m in ipairs(vim.api.nvim_get_keymap(mode)) do
        if m.desc and m.desc ~= "" then
          local d = m.desc:gsub("[\\t\\n]", " ")
          io.write(m.lhs .. "\\t" .. mode .. "\\t" .. d .. "\\n")
        end
      end
    end`;
  const stdout = await execAt(
    bin,
    ["--headless", "-c", "lua " + lua, "-c", "qa!"],
    nvimPath,
  );
  return (
    stdout
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split("\t"))
      // Drop <Plug>/<SNR> pseudo-mappings: their lhs isn't a real key you press,
      // it's an internal handle other mappings reference.
      .filter(([lhs]) => !/^<(Plug|SNR)>/.test(lhs))
      // Drop built-in defaults whose "description" is a raw command, not a
      // human phrase (Neovim sets desc=":bprevious"/"<Plug>…" for these).
      .filter(
        ([, , action]) =>
          action && !/^\s*(:|<Plug>|<Cmd>|<SNR>|<Nop>|vim\.)/.test(action),
      )
      .map(([lhs, mode, action]) => ({
        keys: renderNvimKeys(lhs),
        action,
        source: "nvim",
        mode: MODE[mode] ?? mode,
      }))
  );
}
