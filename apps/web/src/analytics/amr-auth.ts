import type {
  AmrAuthResultProps,
  AmrEntryAttribution,
  TrackingAmrEntrySource,
  TrackingPageName,
} from '@open-design/contracts/analytics';
import { amrEntryPageForSource } from './amr-attribution';
import { setAnalyticsUserId } from './client';
import { trackAmrAuthResult } from './events';

type Track = (
  event: string,
  properties: Record<string, unknown>,
  options?: { requestId?: string; insertId?: string },
) => void;

interface ActiveAmrAuthAttempt {
  startedAt: number;
  pageName: TrackingPageName;
  entryId?: string;
  sourceDetail?: TrackingAmrEntrySource;
}

let active: ActiveAmrAuthAttempt | null = null;

export function beginAmrAuthTracking(
  attribution: AmrEntryAttribution | null | undefined,
  startedAt: number = Date.now(),
): void {
  active = {
    startedAt,
    pageName: attribution
      ? amrEntryPageForSource(attribution.sourceDetail)
      : 'settings',
    entryId: attribution?.entryId,
    sourceDetail: attribution?.sourceDetail,
  };
}

export function resolveAmrAuthTracking(
  track: Track,
  result: AmrAuthResultProps['result'],
  errorCode?: string,
  options?: { signedInUserId?: string | null },
): void {
  if (options && 'signedInUserId' in options) {
    setAnalyticsUserId(options.signedInUserId ?? null);
  }
  if (!active) return;
  const attempt = active;
  active = null;
  trackAmrAuthResult(track, {
    page_name: attempt.pageName,
    area: 'amr_auth',
    result,
    ...(errorCode ? { error_code: errorCode } : {}),
    duration_ms: Math.max(0, Date.now() - attempt.startedAt),
    ...(attempt.entryId ? { entry_id: attempt.entryId } : {}),
    ...(attempt.sourceDetail ? { source_detail: attempt.sourceDetail } : {}),
  });
}
