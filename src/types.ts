export type Shortcut = {
  keys: string;
  action: string;
  source: string;
  mode?: string;
  iconPath?: string;
};

/** Runs one tool's extraction. `path` is the resolved login-shell PATH. */
export type Extractor = (path: string) => Promise<Shortcut[]>;
