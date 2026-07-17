import { existsSync } from "node:fs";
import { Color, Icon } from "@raycast/api";
import { Extractor } from "../types";
import { ghostty } from "./ghostty";
import { nvim } from "./nvim";
import { tmux } from "./tmux";
import { zsh } from "./zsh";
import { obsidian } from "./obsidian";
import { vscode, cursor } from "./vscode";
import { zed } from "./zed";
import { accessibility } from "./accessibility";

// `app` (optional) is the .app bundle path; when it exists on disk the row uses
// the real macOS app icon instead of `icon` (the glyph fallback).
export type Source = {
  name: string;
  color: Color;
  icon: Icon;
  run: Extractor;
  app?: string;
};

// Color matches each tool's brand; icon reflects the kind of app.
// The accessibility source emits per-GUI-app rows (source = app name), so its
// registry color/icon are only fallbacks — see DEFAULT_COLOR/ICON below.
export const SOURCES: Source[] = [
  {
    name: "ghostty",
    color: Color.Purple,
    icon: Icon.Terminal,
    run: ghostty,
    app: "/Applications/Ghostty.app",
  },
  { name: "nvim", color: Color.Green, icon: Icon.Pencil, run: nvim },
  { name: "tmux", color: Color.Yellow, icon: Icon.Window, run: tmux },
  { name: "zsh", color: Color.Orange, icon: Icon.Terminal, run: zsh },
  {
    name: "obsidian",
    color: Color.Magenta,
    icon: Icon.Document,
    run: obsidian,
    app: "/Applications/Obsidian.app",
  },
  {
    name: "vscode",
    color: Color.Blue,
    icon: Icon.Code,
    run: vscode,
    app: "/Applications/Visual Studio Code.app",
  },
  {
    name: "cursor",
    color: Color.PrimaryText,
    icon: Icon.Code,
    run: cursor,
    app: "/Applications/Cursor.app",
  },
  {
    name: "zed",
    color: Color.SecondaryText,
    icon: Icon.Code,
    run: zed,
    app: "/Applications/Zed.app",
  },
  {
    name: "accessibility",
    color: Color.SecondaryText,
    icon: Icon.AppWindow,
    run: accessibility,
  },
];

// GUI-app rows from the accessibility source use the app name as their source,
// which won't be in the maps above — these are the fallbacks. Their row icon is
// the real app icon (via fileIcon); this map only tints the source tag pill.
export const DEFAULT_COLOR = Color.SecondaryText;
export const DEFAULT_ICON = Icon.AppWindow;

export const APP_COLOR: Record<string, Color> = {
  Arc: Color.Red,
  Safari: Color.Blue,
  "Google Chrome": Color.Yellow,
  Slack: Color.Magenta,
  Spotify: Color.Green,
  Finder: Color.Blue,
  Notion: Color.PrimaryText,
  "Notion Calendar": Color.PrimaryText,
  Figma: Color.Orange,
  Discord: Color.Purple,
  Mail: Color.Blue,
  Messages: Color.Green,
};

export const SOURCE_COLOR = Object.fromEntries(
  SOURCES.map((s) => [s.name, s.color]),
) as Record<string, Color>;
export const SOURCE_ICON = Object.fromEntries(
  SOURCES.map((s) => [s.name, s.icon]),
) as Record<string, Icon>;

// source name → real app-icon path, only for sources whose .app is installed.
export const SOURCE_APP_PATH: Record<string, string> = Object.fromEntries(
  SOURCES.filter((s) => s.app && existsSync(s.app)).map((s) => [
    s.name,
    s.app as string,
  ]),
);
