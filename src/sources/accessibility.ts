import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Shortcut } from "../types";

const pexec = promisify(execFile);

// JXA (JavaScript for Automation) using the ObjC bridge to the Accessibility
// API — reads every running GUI app's menu-bar shortcuts. No compiled binary,
// so the extension stays pure TS (store-friendly). Requires the host
// (Raycast) to have Accessibility permission.
const JXA = `
ObjC.import('Cocoa');
ObjC.import('ApplicationServices');
// castRefToObject is required: AX out-params come back as raw CFTypeRefs that
// must be cast before use (.count, ObjC.unwrap, or as an AX element).
function attrObj(el, name) {
  var out = Ref();
  if ($.AXUIElementCopyAttributeValue(el, $(name), out) !== 0) return null;
  return out[0] ? ObjC.castRefToObject(out[0]) : null;
}
function num(el, name) { var o = attrObj(el, name); return o ? ObjC.unwrap(o) : 0; }
function str(el, name) { var o = attrObj(el, name); return o ? ObjC.unwrap(o) : null; }
function walk(el, appName, items, depth) {
  if (depth > 8) return;
  var kids = attrObj(el, 'AXChildren');
  if (kids === null) return;
  for (var i = 0; i < kids.count; i++) {
    var item = kids.objectAtIndex(i);
    var glyph = num(item, 'AXMenuItemCmdGlyph');
    var ch = str(item, 'AXMenuItemCmdChar');
    if ((ch && ch.length) || glyph > 0) {
      var title = str(item, 'AXTitle');
      if (title) items.push({ app: appName, title: title, char: ch || '', glyph: glyph, mods: num(item, 'AXMenuItemCmdModifiers') });
    }
    walk(item, appName, items, depth + 1);
  }
}
function run() {
  if (!$.AXIsProcessTrusted()) return JSON.stringify({ ok: false, error: 'not-trusted' });
  var items = [];
  var paths = {}; // app name → bundle path, for rendering the real app icon
  var apps = $.NSWorkspace.sharedWorkspace.runningApplications;
  for (var i = 0; i < apps.count; i++) {
    var a = apps.objectAtIndex(i);
    if (parseInt(a.activationPolicy, 10) !== 0) continue; // regular apps only (have a menu bar)
    var name = ObjC.unwrap(a.localizedName);
    // Skip Raycast itself and apps already covered by a richer config source.
    if (!name || name === 'Raycast' || name === 'Ghostty' || name === 'Cursor' ||
        name === 'Visual Studio Code' || name === 'Code' || name === 'Zed' || name === 'Obsidian') continue;
    try {
      var el = $.AXUIElementCreateApplication(a.processIdentifier);
      $.AXUIElementSetMessagingTimeout(el, 1.0); // don't hang on a wedged app
      var bar = attrObj(el, 'AXMenuBar');
      if (bar !== null) {
        var before = items.length;
        walk(bar, name, items, 0);
        if (items.length > before && a.bundleURL && !paths[name]) paths[name] = ObjC.unwrap(a.bundleURL.path);
      }
    } catch (e) { /* skip this app */ }
  }
  return JSON.stringify({ ok: true, items: items, paths: paths });
}
`;

// Carbon menu-glyph code → symbol (for keys with no character, e.g. arrows).
const GLYPH: Record<number, string> = {
  2: "⇥",
  3: "⇤",
  4: "⌤",
  9: "␣",
  10: "⌦",
  11: "↩",
  12: "↩",
  23: "⌫",
  27: "⎋",
  28: "⌧",
  98: "PgUp",
  100: "←",
  101: "→",
  102: "Home",
  103: "Help",
  104: "↑",
  105: "End",
  106: "↓",
  107: "PgDn",
  111: "F1",
  112: "F2",
  113: "F3",
  114: "F4",
  115: "F5",
  116: "F6",
  117: "F7",
  118: "F8",
  119: "F9",
  120: "F10",
  121: "F11",
  122: "F12",
  135: "F13",
  136: "F14",
  137: "F15",
};

// AXMenuItemCmdModifiers: shift=1, option=2, control=4; command present UNLESS bit 8 set.
function renderKeys(mods: number, char: string, glyph: number): string | null {
  let out = "";
  if (mods & 4) out += "⌃";
  if (mods & 2) out += "⌥";
  if (mods & 1) out += "⇧";
  if (!(mods & 8)) out += "⌘";
  // Glyph wins; otherwise the char must be a printable ASCII key (some apps
  // report junk chars like "♡" on items that have no real shortcut).
  const key =
    glyph > 0
      ? GLYPH[glyph]
      : /^[\x21-\x7e]$/.test(char)
        ? char.toUpperCase()
        : null;
  if (!key) return null;
  return out + key;
}

type RawItem = {
  app: string;
  title: string;
  char: string;
  glyph: number;
  mods: number;
};

export async function accessibility(): Promise<Shortcut[]> {
  const { stdout } = await pexec(
    "/usr/bin/osascript",
    ["-l", "JavaScript", "-e", JXA],
    {
      maxBuffer: 32 * 1024 * 1024,
      timeout: 20000,
    },
  );
  const res = JSON.parse(stdout) as {
    ok: boolean;
    error?: string;
    items?: RawItem[];
    paths?: Record<string, string>;
  };
  if (!res.ok)
    throw new Error(
      res.error === "not-trusted"
        ? "Accessibility permission needed"
        : (res.error ?? "failed"),
    );

  const paths = res.paths ?? {};
  const seen = new Set<string>();
  const out: Shortcut[] = [];
  for (const it of res.items ?? []) {
    const keys = renderKeys(it.mods, it.char, it.glyph);
    if (!keys) continue;
    const dedup = it.app + "\0" + keys + "\0" + it.title;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    // source = app name (Arc, Slack, …); iconPath renders the real app icon.
    out.push({
      keys,
      action: it.title,
      source: it.app,
      iconPath: paths[it.app],
    });
  }
  return out;
}
