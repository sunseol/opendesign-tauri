import { describe, expect, it, vi } from 'vitest';

import {
  mirrorAmrEntryAnalytics,
  parseAmrEntryAnalyticsPayload,
  parseVelaLoginAttribution,
  type AmrEntryAnalyticsPayload,
} from '../../src/integrations/vela.js';

const attribution = {
  entryId: 'od-amr-entry-123',
  sourceProduct: 'open_design',
  sourceDetail: 'chat_error_recharge',
  occurredAt: '2026-06-03T12:00:00.000Z',
} as const;

const payload: AmrEntryAnalyticsPayload = {
  pageName: 'open_design',
  sourcePageName: 'chat_panel',
  area: 'amr_entry',
  element: 'chat_error_recharge',
  action: 'click_amr_entry',
  entryId: attribution.entryId,
  sourceProduct: 'open_design',
  sourceDetail: 'chat_error_recharge',
  entryOccurredAt: attribution.occurredAt,
};

describe('AMR Vela login attribution', () => {
  it('accepts valid login attribution payloads', () => {
    expect(parseVelaLoginAttribution({ attribution })).toEqual(attribution);
  });

  it('rejects unknown AMR entry sources', () => {
    expect(
      parseVelaLoginAttribution({
        attribution: { ...attribution, sourceDetail: 'unknown_source' },
      }),
    ).toBeNull();
  });
});

describe('AMR entry analytics mirror payloads', () => {
  it('accepts valid web payloads and rejects source/page mismatches', () => {
    expect(parseAmrEntryAnalyticsPayload({ payload })).toEqual(payload);
    expect(
      parseAmrEntryAnalyticsPayload({
        payload: { ...payload, sourcePageName: 'settings' },
      }),
    ).toBeNull();
  });

  it('mirrors entry events to AMR analytics with Open Design context', async () => {
    const fetchImpl = vi.fn(
      async (
        _input: string,
        _init: {
          method: 'POST';
          headers: Record<string, string>;
          body: string;
          signal?: AbortSignal;
        },
      ) => ({ ok: true, status: 202 }),
    );

    const result = await mirrorAmrEntryAnalytics(payload, {
      analyticsContext: {
        deviceId: 'device-123',
        sessionId: 'session-456',
        locale: 'ko',
      },
      appVersion: '0.10.0-tauri',
      env: {
        NODE_ENV: 'test',
        OPEN_DESIGN_AMR_ANALYTICS_URL: 'https://amr.example/events',
      },
      fetchImpl,
    });

    expect(result).toEqual({ mirrored: true, status: 202 });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://amr.example/events',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }),
    );
    const init = fetchImpl.mock.calls[0]![1];
    const body = JSON.parse(String(init.body));
    expect(body.events[0].payload).toEqual(payload);
    expect(body.events[0].common).toMatchObject({
      eventId: 'od-amr-entry-od-amr-entry-123',
      eventName: 'amr_entry',
      platform: 'web',
      env: 'test',
      anonymousId: 'device-123',
      sessionId: 'session-456',
      appVersion: '0.10.0-tauri',
      locale: 'ko',
      traceId: 'od-amr-entry-123',
    });
  });
});
