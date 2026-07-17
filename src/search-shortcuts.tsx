import {
  List,
  ActionPanel,
  Action,
  Icon,
  Color,
  open,
  getPreferenceValues,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { Shortcut } from "./types";
import { loginPath } from "./shell";
import {
  SOURCES,
  SOURCE_COLOR,
  SOURCE_ICON,
  SOURCE_APP_PATH,
  APP_COLOR,
  DEFAULT_COLOR,
  DEFAULT_ICON,
} from "./sources";

const ACCESSIBILITY_SETTINGS =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";

async function collect(
  includeAccessibility: boolean,
): Promise<{ items: Shortcut[]; failed: string[] }> {
  const sources = SOURCES.filter(
    (s) => includeAccessibility || s.name !== "accessibility",
  );
  const path = await loginPath();
  const results = await Promise.allSettled(sources.map((s) => s.run(path)));
  const items: Shortcut[] = [];
  const failed: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else {
      failed.push(sources[i].name);
      console.error(`extractor ${sources[i].name} failed:`, r.reason);
    }
  });
  items.sort((a, b) => a.action.localeCompare(b.action));
  return { items, failed };
}

export default function Command() {
  const { includeAccessibility } = getPreferenceValues<{
    includeAccessibility: boolean;
  }>();
  // Cached: shows last results instantly, refreshes in the background.
  const { data, isLoading } = useCachedPromise(
    collect,
    [includeAccessibility],
    {
      initialData: { items: [], failed: [] },
    },
  );
  const { items, failed } = data;
  const accessibilityDenied = failed.includes("accessibility");

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search shortcuts by what they do…"
    >
      {items.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={accessibilityDenied ? Icon.LockDisabled : Icon.MagnifyingGlass}
          title={
            accessibilityDenied
              ? "Accessibility permission needed"
              : "No shortcuts found"
          }
          description={
            accessibilityDenied
              ? "Enable Raycast in System Settings › Privacy & Security › Accessibility, then reopen."
              : "No supported apps or configs were detected."
          }
          actions={
            accessibilityDenied ? (
              <ActionPanel>
                <Action
                  title="Open Accessibility Settings"
                  icon={Icon.Gear}
                  onAction={() => open(ACCESSIBILITY_SETTINGS)}
                />
              </ActionPanel>
            ) : undefined
          }
        />
      ) : (
        items.map((s, i) => (
          <List.Item
            key={i}
            icon={(() => {
              // real app icon (accessibility rows carry their own path; config
              // sources map to an installed .app), else the tinted glyph fallback.
              const appIcon = s.iconPath ?? SOURCE_APP_PATH[s.source];
              return appIcon
                ? { fileIcon: appIcon }
                : {
                    source: SOURCE_ICON[s.source] ?? DEFAULT_ICON,
                    tintColor: SOURCE_COLOR[s.source] ?? DEFAULT_COLOR,
                  };
            })()}
            title={s.action || s.keys}
            keywords={[s.keys, s.source, s.mode ?? ""]}
            accessories={[
              { tag: { value: s.keys, color: Color.SecondaryText } },
              ...(s.mode
                ? [{ tag: { value: s.mode, color: Color.Orange } }]
                : []),
              {
                tag: {
                  value: s.source,
                  color:
                    SOURCE_COLOR[s.source] ??
                    APP_COLOR[s.source] ??
                    DEFAULT_COLOR,
                },
              },
            ]}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  title="Copy Keys"
                  content={s.keys}
                  icon={Icon.Clipboard}
                />
                <Action.CopyToClipboard
                  title="Copy Action"
                  content={s.action}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
