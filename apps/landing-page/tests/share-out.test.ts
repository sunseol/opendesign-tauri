import assert from 'node:assert/strict';
import { test } from 'node:test';

import { onRequest } from '../functions/share-out/[eventId]';

type StoredWrite = {
  readonly key: string;
  readonly value: string;
};

type ShareOutRecord = {
  readonly eventId: string;
  readonly lang: string;
  readonly clickedAt: string;
  readonly destination: string;
  readonly destinationHost: string;
  readonly referer: string | null;
  readonly userAgentHash: string;
  readonly country?: string;
  readonly region?: string;
};

class MemoryKv {
  readonly writes: StoredWrite[] = [];

  async put(key: string, value: string): Promise<void> {
    this.writes.push({ key, value });
  }
}

function isShareOutRecord(value: unknown): value is ShareOutRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value;
  return (
    typeof Reflect.get(record, 'eventId') === 'string' &&
    typeof Reflect.get(record, 'lang') === 'string' &&
    typeof Reflect.get(record, 'clickedAt') === 'string' &&
    typeof Reflect.get(record, 'destination') === 'string' &&
    typeof Reflect.get(record, 'destinationHost') === 'string' &&
    (typeof Reflect.get(record, 'referer') === 'string' || Reflect.get(record, 'referer') === null) &&
    typeof Reflect.get(record, 'userAgentHash') === 'string'
  );
}

function parseShareOutRecord(value: string): ShareOutRecord {
  const parsed: unknown = JSON.parse(value);
  if (!isShareOutRecord(parsed)) throw new Error('Invalid share-out record');
  return parsed;
}

function contextFor({
  eventId,
  env = {},
  requestUrl,
  waitUntil,
}: {
  readonly eventId: string | string[];
  readonly env?: { readonly SHARE_OUT_CLICK_EVENTS?: MemoryKv; readonly SHARE_CLICK_SALT?: string };
  readonly requestUrl: string;
  readonly waitUntil?: (promise: Promise<unknown>) => void;
}): Parameters<typeof onRequest>[0] {
  const request = Object.assign(new Request(requestUrl, {
    headers: {
      'cf-connecting-ip': '203.0.113.10',
      referer: 'https://github.com/',
      'user-agent': 'node-test',
    },
  }), { cf: { country: 'KR', region: 'Seoul' } });
  return {
    request,
    params: { eventId },
    env,
    waitUntil: waitUntil ?? (() => undefined),
  };
}

test('share-out redirects to allowlisted X destinations and records the click', async () => {
  const kv = new MemoryKv();
  const pending: Promise<unknown>[] = [];
  const destination = 'https://x.com/intent/tweet?text=Open%20Design';

  const response = await onRequest(
    contextFor({
      eventId: 'event-123',
      env: { SHARE_OUT_CLICK_EVENTS: kv, SHARE_CLICK_SALT: 'test-salt' },
      requestUrl: `https://open-design.ai/share-out/event-123?lang=ko&to=${encodeURIComponent(destination)}`,
      waitUntil: (promise) => pending.push(promise),
    }),
  );
  await Promise.all(pending);

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), destination);
  assert.equal(kv.writes.length, 1);
  assert.match(kv.writes[0]?.key ?? '', /^share-out:event-123:/);
  const record = parseShareOutRecord(kv.writes[0]?.value ?? '{}');
  assert.equal(record.eventId, 'event-123');
  assert.equal(record.lang, 'ko');
  assert.equal(record.destination, destination);
  assert.equal(record.destinationHost, 'x.com');
  assert.equal(record.referer, 'https://github.com/');
  assert.equal(record.country, 'KR');
  assert.equal(record.region, 'Seoul');
  assert.match(record.userAgentHash, /^[a-f0-9]{64}$/);
});

test('share-out falls back to x.com for unsafe destinations', async () => {
  const kv = new MemoryKv();
  const response = await onRequest(
    contextFor({
      eventId: 'event-unsafe',
      env: { SHARE_OUT_CLICK_EVENTS: kv },
      requestUrl: 'https://open-design.ai/share-out/event-unsafe?to=https%3A%2F%2Fexample.com%2F',
    }),
  );

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://x.com/');
  assert.equal(kv.writes.length, 1);
});

test('share-out rejects missing event ids after normalization', async () => {
  const response = await onRequest(
    contextFor({
      eventId: '***',
      requestUrl: 'https://open-design.ai/share-out/***',
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(await response.text(), 'Missing share event id');
});
