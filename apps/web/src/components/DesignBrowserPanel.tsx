import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { DesignBrowserReferenceBoard } from './DesignBrowserReferenceBoard';
import {
  EMPTY_BROWSER_URL,
  faviconUrl,
  isHistoryUrl,
  labelFromUrl,
  loadHistory,
  normalizeBrowserAddress,
  referenceIconUrl,
  sameUrl,
  saveHistory,
  type BrowserHistoryEntry,
} from './design-browser-model';
import type { ReferenceSite } from './design-browser-references';
import { Icon } from './Icon';

export type BrowserPageInfo = {
  readonly iconUrl?: string;
  readonly title: string;
  readonly url: string;
};

export type DesignBrowserPanelProps = {
  readonly initialIconUrl?: string;
  readonly initialTitle?: string;
  readonly initialUrl?: string;
  readonly projectId: string;
  readonly resolvedDir?: string | null;
  readonly onOpenFile: (name: string) => void;
  readonly onRefreshFiles: () => Promise<void> | void;
  readonly onPageInfoChange?: (info: BrowserPageInfo) => void;
};

export function DesignBrowserPanel({
  initialIconUrl,
  initialTitle,
  initialUrl,
  projectId,
  onPageInfoChange,
}: DesignBrowserPanelProps) {
  const initialInfo = useMemo(
    () => initialPageInfo(initialUrl, initialTitle, initialIconUrl),
    [initialIconUrl, initialTitle, initialUrl],
  );
  const [pageInfo, setPageInfo] = useState<BrowserPageInfo>(initialInfo);
  const [addressValue, setAddressValue] = useState(initialInfo.url === EMPTY_BROWSER_URL ? '' : initialInfo.url);
  const [history, setHistory] = useState<readonly BrowserHistoryEntry[]>(() => loadHistory(projectId));

  useEffect(() => {
    setHistory(loadHistory(projectId));
  }, [projectId]);

  function openUrl(url: string, title = labelFromUrl(url), explicitIconUrl?: string): void {
    const nextInfo = pageInfoForUrl(url, title, explicitIconUrl);
    setPageInfo(nextInfo);
    setAddressValue(url === EMPTY_BROWSER_URL ? '' : url);
    onPageInfoChange?.(nextInfo);
    if (!isHistoryUrl(url)) return;
    setHistory((current) => {
      const existing = current.find((entry) => sameUrl(entry.url, url));
      const nextEntry = historyEntryForPage(nextInfo, existing);
      const nextHistory = [nextEntry, ...current.filter((entry) => !sameUrl(entry.url, url))];
      saveHistory(projectId, nextHistory);
      return nextHistory;
    });
  }

  function openReference(site: ReferenceSite): void {
    openUrl(site.url, site.label, referenceIconUrl(site.url));
  }

  function openHistoryEntry(entry: BrowserHistoryEntry): void {
    openUrl(entry.url, entry.title, entry.iconUrl);
  }

  function submitAddress(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalized = normalizeBrowserAddress(addressValue);
    openUrl(normalized, labelFromUrl(normalized), faviconUrl(normalized));
  }

  return (
    <section className="db-panel" aria-label="Design browser">
      <form className="db-address-bar" onSubmit={submitAddress}>
        <button type="button" aria-label="Browser home" onClick={() => openUrl(EMPTY_BROWSER_URL)}>
          <Icon name="home" size={13} />
        </button>
        <input
          type="text"
          value={addressValue}
          onChange={(event) => setAddressValue(event.currentTarget.value)}
          placeholder="Search or enter address"
          aria-label="Browser address"
        />
        <button type="submit" aria-label="Open address">
          <Icon name="external-link" size={13} />
          Open
        </button>
      </form>

      <div className="db-current-page" role="status">
        <span>{pageInfo.title}</span>
        <small>{pageInfo.url === EMPTY_BROWSER_URL ? 'Ready for references' : pageInfo.url}</small>
      </div>

      {history.length > 0 ? (
        <section className="db-history" aria-label="Browser history">
          <h3>History</h3>
          <div className="db-history-list">
            {history.slice(0, 8).map((entry) => (
              <button key={entry.url} type="button" onClick={() => openHistoryEntry(entry)} aria-label={`Reopen ${entry.title}`}>
                <Icon name="history" size={13} />
                <span>{entry.title}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <DesignBrowserReferenceBoard onOpenReference={openReference} />
    </section>
  );
}

function initialPageInfo(initialUrl?: string, initialTitle?: string, initialIconUrl?: string): BrowserPageInfo {
  const rawUrl = initialUrl?.trim();
  if (!rawUrl) return pageInfoForUrl(EMPTY_BROWSER_URL, 'New Tab', initialIconUrl);
  if (hasUnsupportedExplicitScheme(rawUrl)) return pageInfoForUrl(EMPTY_BROWSER_URL, 'New Tab', initialIconUrl);
  const normalized = normalizeBrowserAddress(rawUrl);
  if (!isHistoryUrl(normalized)) return pageInfoForUrl(EMPTY_BROWSER_URL, 'New Tab', initialIconUrl);
  return pageInfoForUrl(normalized, initialTitle?.trim() || labelFromUrl(normalized), initialIconUrl);
}

function hasUnsupportedExplicitScheme(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/iu.test(url) && !/^(https?|file):\/\//iu.test(url) && url !== EMPTY_BROWSER_URL;
}

function pageInfoForUrl(url: string, title: string, explicitIconUrl?: string): BrowserPageInfo {
  const iconUrl = explicitIconUrl || referenceIconUrl(url) || faviconUrl(url);
  return iconUrl ? { iconUrl, title, url } : { title, url };
}

function historyEntryForPage(info: BrowserPageInfo, existing: BrowserHistoryEntry | undefined): BrowserHistoryEntry {
  const visitCount = (existing?.visitCount ?? 0) + 1;
  const lastVisitedAt = Date.now();
  return info.iconUrl
    ? { iconUrl: info.iconUrl, lastVisitedAt, title: info.title, url: info.url, visitCount }
    : { lastVisitedAt, title: info.title, url: info.url, visitCount };
}
