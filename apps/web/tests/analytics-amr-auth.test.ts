import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AmrEntryAttribution } from '@open-design/contracts/analytics';

vi.mock('../src/analytics/client', () => ({
  setAnalyticsUserId: vi.fn(),
}));

import { setAnalyticsUserId } from '../src/analytics/client';
import {
  beginAmrAuthTracking,
  resolveAmrAuthTracking,
} from '../src/analytics/amr-auth';

const attribution: AmrEntryAttribution = {
  entryId: 'od-amr-test-entry',
  sourceProduct: 'open_design',
  sourceDetail: 'inline_model_switcher_amr_row',
  occurredAt: new Date().toISOString(),
};

describe('amr-auth single-flight tracking', () => {
  const track = vi.fn();

  beforeEach(() => {
    track.mockClear();
    resolveAmrAuthTracking(() => undefined, 'cancelled');
    vi.mocked(setAnalyticsUserId).mockClear();
  });

  it('fires one amr_auth_result with attribution on success', () => {
    beginAmrAuthTracking(attribution, Date.now() - 1500);
    resolveAmrAuthTracking(track, 'success');
    expect(track).toHaveBeenCalledTimes(1);
    const [event, props] = track.mock.calls[0] as [string, Record<string, unknown>];
    expect(event).toBe('amr_auth_result');
    expect(props).toMatchObject({
      page_name: 'chat_panel',
      area: 'amr_auth',
      result: 'success',
      entry_id: 'od-amr-test-entry',
      source_detail: 'inline_model_switcher_amr_row',
    });
    expect(props.duration_ms).toBeGreaterThanOrEqual(1500);
    expect(props).not.toHaveProperty('error_code');
  });

  it('ignores later resolves for the same attempt', () => {
    beginAmrAuthTracking(attribution);
    resolveAmrAuthTracking(track, 'success');
    resolveAmrAuthTracking(track, 'failed', 'login_stopped');
    resolveAmrAuthTracking(track, 'cancelled');
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('falls back to the settings page without attribution', () => {
    beginAmrAuthTracking(null);
    resolveAmrAuthTracking(track, 'timeout', 'login_timeout');
    const [, props] = track.mock.calls[0] as [string, Record<string, unknown>];
    expect(props).toMatchObject({
      page_name: 'settings',
      result: 'timeout',
      error_code: 'login_timeout',
    });
    expect(props).not.toHaveProperty('entry_id');
    expect(props).not.toHaveProperty('source_detail');
  });

  it('registers the signed-in user id before emitting the success row', () => {
    beginAmrAuthTracking(attribution);
    resolveAmrAuthTracking(track, 'success', undefined, {
      signedInUserId: 'usr_amr_42',
    });
    const setUserMock = vi.mocked(setAnalyticsUserId);
    expect(setUserMock).toHaveBeenCalledWith('usr_amr_42');
    expect(track).toHaveBeenCalledTimes(1);
    expect(setUserMock.mock.invocationCallOrder[0]).toBeLessThan(
      track.mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY,
    );
  });
});
