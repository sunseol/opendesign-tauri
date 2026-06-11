import { useEffect, useState } from 'react';

import { Icon } from './Icon';

function fontBannerDismissKey(projectId: string): string {
  return `od:font-banner-dismissed:${projectId}`;
}

export function isFontBannerDismissed(projectId: string): boolean {
  if (!projectId || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(fontBannerDismissKey(projectId)) === '1';
  } catch {
    return false;
  }
}

interface MissingBrandFontsBannerProps {
  projectId: string;
  className?: string;
  onUploadAssets?: () => void;
}

export function MissingBrandFontsBanner({
  projectId,
  className = 'ds-project-warning-card',
  onUploadAssets,
}: MissingBrandFontsBannerProps) {
  const [dismissed, setDismissed] = useState(() => isFontBannerDismissed(projectId));

  useEffect(() => {
    setDismissed(isFontBannerDismissed(projectId));
  }, [projectId]);

  if (dismissed) return null;

  function useSystemFonts(): void {
    if (projectId && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(fontBannerDismissKey(projectId), '1');
      } catch {
        // Storage may be unavailable; still hide for this session.
      }
    }
    setDismissed(true);
  }

  return (
    <div className={className}>
      <Icon name="help-circle" size={16} />
      <span>
        <strong>Missing brand fonts</strong>
        <small>Open Design is rendering typography with substitute web fonts.</small>
      </span>
      <div className="ds-warning-card-actions">
        {onUploadAssets ? (
          <button type="button" className="ghost compact" onClick={onUploadAssets}>
            <Icon name="upload" size={13} />
            Upload fonts
          </button>
        ) : null}
        <button type="button" className="ghost compact" onClick={useSystemFonts}>
          Use system fonts
        </button>
      </div>
    </div>
  );
}
