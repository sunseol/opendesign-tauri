import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { __newsletterSubscribeTest, onRequest } from '../functions/subscribe.ts';

type TestKv = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

type FetchCall = {
  readonly init: RequestInit;
  readonly url: string;
};

type NewsletterRecord = {
  readonly email: string;
  readonly referer: string | null;
  readonly source: string;
  readonly subscribedAt: string;
  readonly userAgentHash: string;
  readonly country?: string;
  readonly region?: string;
  readonly welcomeEmailAttemptedAt?: string;
  readonly welcomeEmailId?: string;
  readonly welcomeEmailSentAt?: string;
};

type SubscribeEnv = {
  readonly NEWSLETTER_SALT?: string;
  readonly NEWSLETTER_SUBSCRIBERS?: TestKv;
  readonly RESEND_API_KEY?: string;
  readonly RESEND_NEWSLETTER_SEGMENT_ID?: string;
  readonly RESEND_WELCOME_EMAIL_ENABLED?: string;
};

const BASE_RECORD = {
  email: 'user@example.com',
  subscribedAt: '2026-06-05T00:00:00.000Z',
  source: 'landing',
  referer: 'https://open-design.ai/',
  userAgentHash: 'agent-hash',
} satisfies NewsletterRecord;

class MemoryKv implements TestKv {
  readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

function createFetchRecorder(emailResponseStatus = 200): {
  readonly calls: FetchCall[];
  readonly fetcher: typeof fetch;
} {
  const calls: FetchCall[] = [];
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ init, url });

    if (url === 'https://api.resend.com/emails') {
      return new Response(JSON.stringify({ id: 'welcome-email-id' }), {
        headers: { 'Content-Type': 'application/json' },
        status: emailResponseStatus,
      });
    }

    return new Response(JSON.stringify({ id: 'contact-id' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  };

  return { calls, fetcher };
}

function createEnv(kv: TestKv): SubscribeEnv {
  return {
    NEWSLETTER_SALT: 'test-salt',
    NEWSLETTER_SUBSCRIBERS: kv,
    RESEND_API_KEY: 're_test',
    RESEND_NEWSLETTER_SEGMENT_ID: 'segment-id',
  };
}

function isNewsletterRecord(value: unknown): value is NewsletterRecord {
  if (typeof value !== 'object' || value === null) return false;

  const attemptedAt = Reflect.get(value, 'welcomeEmailAttemptedAt');
  const emailId = Reflect.get(value, 'welcomeEmailId');
  const sentAt = Reflect.get(value, 'welcomeEmailSentAt');

  return (
    typeof Reflect.get(value, 'email') === 'string' &&
    (typeof Reflect.get(value, 'referer') === 'string' || Reflect.get(value, 'referer') === null) &&
    typeof Reflect.get(value, 'source') === 'string' &&
    typeof Reflect.get(value, 'subscribedAt') === 'string' &&
    typeof Reflect.get(value, 'userAgentHash') === 'string' &&
    (attemptedAt === undefined || typeof attemptedAt === 'string') &&
    (emailId === undefined || typeof emailId === 'string') &&
    (sentAt === undefined || typeof sentAt === 'string')
  );
}

function parseNewsletterRecord(value: string | undefined): NewsletterRecord {
  if (!value) throw new Error('Missing newsletter record');

  const parsed: unknown = JSON.parse(value);
  if (!isNewsletterRecord(parsed)) throw new Error('Invalid newsletter record');
  return parsed;
}

function fetchCallAt(calls: readonly FetchCall[], index: number): FetchCall {
  const call = calls[index];
  if (!call) throw new Error(`Missing fetch call ${index}`);
  return call;
}

function jsonBodyProperty(body: BodyInit | null | undefined, key: string): unknown {
  const parsed: unknown = JSON.parse(String(body));
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  return Reflect.get(parsed, key);
}

function contextFor({
  env,
  request,
  waitUntil,
}: {
  readonly env: SubscribeEnv;
  readonly request: Request;
  readonly waitUntil?: (promise: Promise<unknown>) => void;
}): Parameters<typeof onRequest>[0] {
  return {
    env,
    request: Object.assign(request, { cf: { country: 'KR', region: 'Seoul' } }),
    waitUntil: waitUntil ?? (() => undefined),
  };
}

describe('newsletter subscribe', () => {
  it('allows packaged desktop app requests from the od protocol', () => {
    const headers = __newsletterSubscribeTest.corsHeaders('od://app');

    assert.equal(headers['Access-Control-Allow-Origin'], 'od://app');
  });

  it('allows localhost web runtime requests', () => {
    const headers = __newsletterSubscribeTest.corsHeaders('http://127.0.0.1:58100');

    assert.equal(headers['Access-Control-Allow-Origin'], 'http://127.0.0.1:58100');
  });

  it('handles POST requests and schedules durable persistence', async () => {
    const kv = new MemoryKv();
    const pending: Promise<unknown>[] = [];
    const { fetcher } = createFetchRecorder();
    const originalFetch = globalThis.fetch;
    const request = new Request('https://open-design.ai/subscribe', {
      body: JSON.stringify({ email: 'User@Example.COM ', source: 'client' }),
      headers: {
        'Content-Type': 'application/json',
        origin: 'od://app',
        referer: 'od://app/onboarding',
        'user-agent': 'node-test',
      },
      method: 'POST',
    });

    globalThis.fetch = fetcher;
    let response: Response;
    try {
      response = await onRequest(
        contextFor({
          env: createEnv(kv),
          request,
          waitUntil: (promise) => pending.push(promise),
        }),
      );
      await Promise.all(pending);
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'od://app');
    assert.deepEqual(await response.json(), { ok: true });

    const entries = [...kv.values.entries()];
    assert.equal(entries.length, 1);
    assert.match(entries[0]?.[0] ?? '', /^sub:[a-f0-9]{64}$/);

    const record = parseNewsletterRecord(entries[0]?.[1]);
    assert.equal(record.email, 'user@example.com');
    assert.equal(record.source, 'client');
    assert.equal(record.referer, 'od://app/onboarding');
    assert.equal(record.country, 'KR');
    assert.equal(record.region, 'Seoul');
  });

  it('sends and records a welcome email for a new subscriber', async () => {
    const kv = new MemoryKv();
    const { calls, fetcher } = createFetchRecorder();

    await __newsletterSubscribeTest.persistNewsletterSubscription(
      createEnv(kv),
      'sub:abc',
      BASE_RECORD,
      fetcher,
    );

    assert.equal(calls.length, 2);
    assert.equal(fetchCallAt(calls, 0).url, 'https://api.resend.com/contacts');
    const emailCall = fetchCallAt(calls, 1);
    assert.equal(emailCall.url, 'https://api.resend.com/emails');
    assert.equal(new Headers(emailCall.init.headers).get('Idempotency-Key'), 'newsletter-welcome-sub:abc');
    assert.equal(jsonBodyProperty(emailCall.init.body, 'from'), 'Open Design <updates@open-design.ai>');
    assert.equal(jsonBodyProperty(emailCall.init.body, 'reply_to'), 'updates@open-design.ai');
    assert.equal(jsonBodyProperty(emailCall.init.body, 'to'), 'user@example.com');

    const stored = parseNewsletterRecord(kv.values.get('sub:abc'));
    assert.equal(stored.welcomeEmailId, 'welcome-email-id');
    assert.equal(typeof stored.welcomeEmailAttemptedAt, 'string');
    assert.equal(typeof stored.welcomeEmailSentAt, 'string');
  });

  it('does not backfill welcome email for legacy subscribers without a welcome attempt', async () => {
    const kv = new MemoryKv();
    await kv.put('sub:abc', JSON.stringify(BASE_RECORD));
    const { calls, fetcher } = createFetchRecorder();

    await __newsletterSubscribeTest.persistNewsletterSubscription(
      createEnv(kv),
      'sub:abc',
      { ...BASE_RECORD, subscribedAt: '2026-06-05T01:00:00.000Z' },
      fetcher,
    );

    assert.equal(calls.length, 1);
    assert.equal(fetchCallAt(calls, 0).url, 'https://api.resend.com/contacts');

    const stored = parseNewsletterRecord(kv.values.get('sub:abc'));
    assert.equal(stored.welcomeEmailAttemptedAt, undefined);
    assert.equal(stored.welcomeEmailSentAt, undefined);
    assert.equal(stored.subscribedAt, '2026-06-05T01:00:00.000Z');
  });

  it('retries welcome email when a previous first-subscribe attempt did not send', async () => {
    const kv = new MemoryKv();
    await kv.put(
      'sub:abc',
      JSON.stringify({
        ...BASE_RECORD,
        welcomeEmailAttemptedAt: '2026-06-05T00:01:00.000Z',
      }),
    );
    const { calls, fetcher } = createFetchRecorder();

    await __newsletterSubscribeTest.persistNewsletterSubscription(
      createEnv(kv),
      'sub:abc',
      { ...BASE_RECORD, subscribedAt: '2026-06-05T02:00:00.000Z' },
      fetcher,
    );

    assert.equal(calls.length, 2);
    assert.equal(fetchCallAt(calls, 1).url, 'https://api.resend.com/emails');

    const stored = parseNewsletterRecord(kv.values.get('sub:abc'));
    assert.equal(stored.welcomeEmailId, 'welcome-email-id');
    assert.equal(typeof stored.welcomeEmailSentAt, 'string');
  });
});
