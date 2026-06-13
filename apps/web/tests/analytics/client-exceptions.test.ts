import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_FETCH = globalThis.fetch;

const ANALYTICS_CONTEXT = {
  anonymousId: 'anon-local',
  sessionId: 'session-1',
  clientType: 'web' as const,
  locale: 'en',
  appVersion: '1.2.3',
};

async function loadAnalyticsModules() {
  vi.resetModules();
  const [client, tracking] = await Promise.all([
    import('../../src/analytics/client'),
    import('../../src/analytics/error-tracking'),
  ]);
  return { client, tracking };
}

describe('exception analytics bootstrap', () => {
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('uses key and host for exceptions even when product analytics are disabled', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/api/analytics/config') {
        return new Response(
          JSON.stringify({
            enabled: false,
            env: 'production',
            key: 'ph_project',
            host: 'https://posthog.example',
            installationId: 'install-123',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    const { client, tracking } = await loadAnalyticsModules();

    await client.bootstrapExceptionTracking(ANALYTICS_CONTEXT);
    tracking.reportSafetyEvent('upload_failed', { reason: 'disk-full' });

    const calls = vi.mocked(globalThis.fetch).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1]?.[0]).toBe('https://posthog.example/i/v0/e/');
    const body = JSON.parse(String(calls[1]?.[1]?.body));
    expect(body).toMatchObject({
      api_key: 'ph_project',
      event: 'upload_failed',
      distinct_id: 'install-123',
      properties: {
        env: 'production',
        session_id: 'session-1',
        app_version: '1.2.3',
        ui_version: '1.2.3',
        capture_source: 'web/error-tracking',
        reason: 'disk-full',
      },
    });
  });

  it('drops buffered safety events when no public key is available', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          enabled: false,
          env: 'development',
          key: null,
          host: null,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const { client, tracking } = await loadAnalyticsModules();

    tracking.reportSafetyEvent('pre_boot_exception', { queued: true });
    await client.bootstrapExceptionTracking(ANALYTICS_CONTEXT);

    expect(vi.mocked(globalThis.fetch).mock.calls).toHaveLength(1);
  });

  it('refreshes exception context when provider reruns with a newer app version', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/api/analytics/config') {
        return new Response(
          JSON.stringify({
            enabled: false,
            env: 'production',
            key: 'ph_project',
            host: 'https://posthog.example',
            installationId: 'install-123',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    const { client, tracking } = await loadAnalyticsModules();

    await client.bootstrapExceptionTracking({
      ...ANALYTICS_CONTEXT,
      appVersion: '0.0.0',
    });
    tracking.reportSafetyEvent('first_exception');
    await client.bootstrapExceptionTracking({
      ...ANALYTICS_CONTEXT,
      appVersion: '2.0.0',
    });
    tracking.reportSafetyEvent('second_exception');

    const eventBodies = vi
      .mocked(globalThis.fetch)
      .mock.calls.filter(([input]) => input === 'https://posthog.example/i/v0/e/')
      .map(([, init]) => JSON.parse(String(init?.body)));

    expect(eventBodies.map((body) => body.properties.app_version)).toEqual([
      '0.0.0',
      '2.0.0',
    ]);
  });
});
