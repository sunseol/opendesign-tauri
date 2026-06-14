import type { OpenTabsState, ProjectBrowserWorkspaceTab } from '../types';

export const DESIGN_FILES_TAB = '__design_files__';
export const DESIGN_SYSTEM_TAB = '__design_system__';
export const BROWSER_TAB_PREFIX = '__browser__:';
export const BROWSER_KEEPALIVE_CAP = 3;

export type BrowserWorkspaceTab = ProjectBrowserWorkspaceTab;

export type WorkspaceOrderedTab =
  | {
    readonly id: string;
    readonly kind: 'browser';
    readonly browserTab: BrowserWorkspaceTab;
  }
  | {
    readonly id: string;
    readonly kind: 'file';
    readonly name: string;
  };

export function isBrowserTabId(tabId: string): boolean {
  return tabId.startsWith(BROWSER_TAB_PREFIX);
}

export function browserTabsFromState(
  value: OpenTabsState['browserTabs'],
): BrowserWorkspaceTab[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tabs: BrowserWorkspaceTab[] = [];
  for (const item of value) {
    if (!item || typeof item.id !== 'string' || seen.has(item.id)) continue;
    if (!isBrowserTabId(item.id)) continue;
    const label = item.label?.trim() || 'Browser';
    const tab: BrowserWorkspaceTab = {
      id: item.id,
      label,
    };
    if (item.insertAfter === null) tab.insertAfter = null;
    else if (typeof item.insertAfter === 'string') tab.insertAfter = item.insertAfter;
    if (item.title?.trim()) tab.title = item.title.trim();
    if (item.url?.trim()) tab.url = item.url.trim();
    if (item.iconUrl?.trim()) tab.iconUrl = item.iconUrl.trim();
    seen.add(item.id);
    tabs.push(tab);
  }
  return tabs;
}

export function maxBrowserTabSequence(tabs: readonly BrowserWorkspaceTab[]): number {
  let max = 0;
  for (const tab of tabs) {
    const suffix = tab.id.slice(BROWSER_TAB_PREFIX.length);
    const value = Number.parseInt(suffix, 10);
    if (Number.isFinite(value)) max = Math.max(max, value);
  }
  return max;
}

export function lastWorkspaceTabId(tabs: readonly WorkspaceOrderedTab[]): string | null {
  return tabs[tabs.length - 1]?.id ?? null;
}

export function orderWorkspaceTabs(
  fileTabNames: readonly string[],
  browserTabs: readonly BrowserWorkspaceTab[],
): WorkspaceOrderedTab[] {
  const ordered: WorkspaceOrderedTab[] = fileTabNames.map((name) => ({
    id: name,
    kind: 'file',
    name,
  }));
  let rootAnchorInsertIndex = 0;

  for (const browserTab of browserTabs) {
    const entry: WorkspaceOrderedTab = {
      id: browserTab.id,
      kind: 'browser',
      browserTab,
    };
    const anchor = browserTab.insertAfter;
    if (!anchor || anchor === DESIGN_FILES_TAB || anchor === DESIGN_SYSTEM_TAB) {
      ordered.splice(rootAnchorInsertIndex, 0, entry);
      rootAnchorInsertIndex += 1;
      continue;
    }
    const anchorIndex = ordered.findIndex((candidate) => candidate.id === anchor);
    if (anchorIndex === -1) {
      ordered.push(entry);
      continue;
    }
    ordered.splice(anchorIndex + 1, 0, entry);
  }

  return ordered;
}
