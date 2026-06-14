import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { captureHostPage } from '@open-design/host';

import { writeProjectBase64File, writeProjectTextFile } from '../providers/registry';
import { DesignBrowserReferenceBoard } from './DesignBrowserReferenceBoard';
import {
  EMPTY_BROWSER_URL,
  browserFileName,
  faviconUrl,
  isHistoryUrl,
  labelFromUrl,
  loadHistory,
  normalizeBrowserAddress,
  pageCaptureSvg,
  pageBriefMarkdown,
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
  onOpenFile,
  projectId,
  onRefreshFiles,
  onPageInfoChange,
}: DesignBrowserPanelProps) {
  const initialInfo = useMemo(
    () => initialPageInfo(initialUrl, initialTitle, initialIconUrl),
    [initialIconUrl, initialTitle, initialUrl],
  );
  const [pageInfo, setPageInfo] = useState<BrowserPageInfo>(initialInfo);
  const [addressValue, setAddressValue] = useState(initialInfo.url === EMPTY_BROWSER_URL ? '' : initialInfo.url);
  const [history, setHistory] = useState<readonly BrowserHistoryEntry[]>(() => loadHistory(projectId));
  const [isSavingBrief, setIsSavingBrief] = useState(false);
  const [isSavingCapture, setIsSavingCapture] = useState(false);
  const [briefStatus, setBriefStatus] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const canSaveBrief = isHistoryUrl(pageInfo.url);

  useEffect(() => {
    setHistory(loadHistory(projectId));
  }, [projectId]);

  function openUrl(url: string, title = labelFromUrl(url), explicitIconUrl?: string): void {
    const nextInfo = pageInfoForUrl(url, title, explicitIconUrl);
    setPageInfo(nextInfo);
    setAddressValue(url === EMPTY_BROWSER_URL ? '' : url);
    setBriefStatus(null);
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

  async function saveCurrentPageBrief(): Promise<void> {
    if (!canSaveBrief || isSavingBrief) return;
    setIsSavingBrief(true);
    setBriefStatus(null);
    const markdown = pageBriefMarkdown({ title: pageInfo.title, url: pageInfo.url }, pageInfo.url);
    const filename = browserFileName('browser-brief', pageInfo.url, 'md');
    try {
      const file = await writeProjectTextFile(projectId, filename, markdown);
      if (!file) {
        setBriefStatus('Brief was not saved');
        return;
      }
      await onRefreshFiles();
      onOpenFile(file.name);
      setBriefStatus('Brief saved');
    } catch (error) {
      if (error instanceof Error) {
        setBriefStatus(error.message);
        return;
      }
      throw error;
    } finally {
      setIsSavingBrief(false);
    }
  }

  async function saveCurrentPageCapture(): Promise<void> {
    if (!canSaveBrief || isSavingCapture) return;
    setIsSavingCapture(true);
    setBriefStatus(null);
    try {
      const capturedDataUrl = await captureCurrentPanelDataUrl(panelRef.current);
      const capturedBase64 = capturedDataUrl ? base64FromDataUrl(capturedDataUrl) : null;
      const file = capturedBase64
        ? await writeProjectBase64File(
          projectId,
          browserFileName('browser-capture', pageInfo.url, 'png'),
          capturedBase64,
        )
        : await writeProjectTextFile(
          projectId,
          browserFileName('browser-capture', pageInfo.url, 'svg'),
          pageCaptureSvg({ title: pageInfo.title, url: pageInfo.url }),
        );
      if (!file) {
        setBriefStatus('Capture was not saved');
        return;
      }
      await onRefreshFiles();
      onOpenFile(file.name);
      setBriefStatus('Capture saved');
    } catch (error) {
      if (error instanceof Error) {
        setBriefStatus(error.message);
        return;
      }
      throw error;
    } finally {
      setIsSavingCapture(false);
    }
  }

  return (
    <section ref={panelRef} className="db-panel" aria-label="Design browser">
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
        <div>
          <button type="submit" aria-label="Open address">
            <Icon name="external-link" size={13} />
            Open
          </button>
          <button
            type="button"
            aria-label="Save brief"
            disabled={!canSaveBrief || isSavingBrief}
            onClick={() => void saveCurrentPageBrief()}
          >
            <Icon name="file" size={13} />
            {isSavingBrief ? 'Saving' : 'Save brief'}
          </button>
          <button
            type="button"
            aria-label="Save capture"
            disabled={!canSaveBrief || isSavingCapture}
            onClick={() => void saveCurrentPageCapture()}
          >
            <Icon name="image" size={13} />
            {isSavingCapture ? 'Saving' : 'Save capture'}
          </button>
        </div>
      </form>

      <div className="db-current-page" role="status">
        <span>{pageInfo.title}</span>
        <small>{pageInfo.url === EMPTY_BROWSER_URL ? 'Ready for references' : pageInfo.url}</small>
        {briefStatus ? <small>{briefStatus}</small> : null}
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

async function captureCurrentPanelDataUrl(panel: HTMLElement | null): Promise<string | null> {
  const rect = panel?.getBoundingClientRect();
  const clip = rect && rect.width > 0 && rect.height > 0
    ? {
      x: Math.max(0, Math.round(rect.left)),
      y: Math.max(0, Math.round(rect.top)),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    }
    : undefined;
  const result = await captureHostPage(clip ? { clip } : undefined);
  return result.ok ? result.dataUrl : null;
}

function base64FromDataUrl(dataUrl: string): string | null {
  const base64Marker = ';base64,';
  const markerIndex = dataUrl.indexOf(base64Marker);
  if (markerIndex < 0) return null;
  const base64 = dataUrl.slice(markerIndex + base64Marker.length).trim();
  return base64 || null;
}
