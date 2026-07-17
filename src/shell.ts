// Binary resolution + execution. Raycast's node runs with a minimal PATH
// (launchd GUI env), so everything resolves through the user's login shell.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { userInfo } from "node:os";

const pexec = promisify(execFile);
const SHELL = process.env.SHELL || "/bin/zsh";
const BIG = { maxBuffer: 16 * 1024 * 1024 };

export const USER = userInfo().username;

/** The PATH from a login shell, matching the user's terminal. */
export async function loginPath(): Promise<string> {
  try {
    const { stdout } = await pexec(SHELL, ["-lc", "echo $PATH"]);
    return stdout.trim() || process.env.PATH || "";
  } catch {
    return process.env.PATH || "";
  }
}

/** Resolve a binary via login shell, falling back to absolute paths (GUI apps). */
export async function which(
  bin: string,
  path: string,
  fallbacks: string[] = [],
): Promise<string | null> {
  try {
    const { stdout } = await pexec(SHELL, ["-lc", `command -v ${bin}`], {
      env: { ...process.env, PATH: path },
    });
    if (stdout.trim()) return stdout.trim();
  } catch {
    /* fall through */
  }
  return fallbacks.find(existsSync) ?? null;
}

/** Run a binary with a given PATH, returning stdout. */
export async function execAt(
  bin: string,
  args: string[],
  path: string,
): Promise<string> {
  const { stdout } = await pexec(bin, args, {
    ...BIG,
    env: { ...process.env, PATH: path },
  });
  return stdout;
}
