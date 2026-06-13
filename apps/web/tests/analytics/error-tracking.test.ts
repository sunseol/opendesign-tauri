// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearExceptionTrackingContext,
  installErrorHandlers,
  reportHandledException,
  setExceptionTrackingContext,
} from '../../src/analytics/error-tracking';

const originalFetch = globalThis.fetch;
let requests: RequestInit[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requestBodies(): Record<string, unknown>[] {
  return requests.map((request) => {
    if (typeof request.body !== 'string') {
      throw new Error('missing request body');
    }
    const parsed: unknown = JSON.parse(request.body);
    if (!isRecord(parsed)) throw new Error('body is not a record');
    return parsed;
  });
}

function lastBody(): Record<string, unknown> {
  const body = requestBodies().at(-1);
  if (!body) throw new Error('missing captured request');
  return body;
}

function recordField(
  value: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  const next = value[field];
  if (!isRecord(next)) throw new Error(`missing record ${field}`);
  return next;
}

function exceptionFrames(body: Record<string, unknown>): Record<string, unknown>[] {
  const properties = recordField(body, 'properties');
  const list = properties.$exception_list;
  if (!Array.isArray(list) || !isRecord(list[0])) {
    throw new Error('missing exception list');
  }
  const stacktrace = recordField(list[0], 'stacktrace');
  const frames = stacktrace.frames;
  if (!Array.isArray(frames)) throw new Error('missing frames');
  return frames.filter(isRecord);
}

beforeEach(() => {
  requests = [];
  globalThis.fetch = async (_input, init) => {
    requests.push(init ?? {});
    return new Response('', { status: 200 });
  };
  clearExceptionTrackingContext();
});

afterEach(() => {
  clearExceptionTrackingContext();
  globalThis.fetch = originalFetch;
});

describe('error-tracking', () => {
  it('buffers handled exceptions until a direct-ingest context is set', () => {
    reportHandledException(new Error('early-boom'));
    expect(requests).toHaveLength(0);

    setExceptionTrackingContext({
      apiKey: 'phc_test',
      host: 'https://us.i.posthog.com',
      distinctId: 'user-1',
      appVersion: '1.2.3',
      sessionId: 'session-abc',
      telemetryEnv: 'test',
    });

    expect(requests).toHaveLength(1);
    expect(lastBody()).toMatchObject({
      api_key: 'phc_test',
      event: '$exception',
      distinct_id: 'user-1',
      properties: expect.objectContaining({
        $exception_type: 'Error',
        $exception_message: 'early-boom',
        app_version: '1.2.3',
        session_id: 'session-abc',
        env: 'test',
      }),
    });
  });

  it('dispatches immediately and scrubs filesystem paths from stack frames', () => {
    setExceptionTrackingContext({
      apiKey: 'phc_test',
      host: 'https://us.i.posthog.com',
      distinctId: 'user-scrub',
    });
    const error = new Error('scrub-target');
    error.stack = [
      'Error: scrub-target',
      '    at handleClick (file:///Applications/Open Design.app/Contents/Resources/apps/web/src/FileViewer.tsx:147:23)',
      '    at /Users/jane/dev/checkout/apps/web/src/index.tsx:12:1',
    ].join('\n');

    reportHandledException(error);

    expect(requests).toHaveLength(1);
    const frames = exceptionFrames(lastBody());
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (const frame of frames) {
      expect(frame.filename).toMatch(/^app:\/\/apps\/web\//);
      expect(frame.filename).not.toContain('Applications/Open Design.app');
      expect(frame.filename).not.toContain('/Users/jane');
    }
  });

  it('captures unhandled promise rejection events from the window hook', () => {
    installErrorHandlers();
    setExceptionTrackingContext({
      apiKey: 'phc_test',
      host: 'https://us.i.posthog.com',
      distinctId: 'user-async',
    });
    const reason = new RangeError('boom-async');
    const event = new Event('unhandledrejection');
    Object.defineProperty(event, 'reason', { value: reason });

    window.dispatchEvent(event);

    expect(lastBody().properties).toMatchObject({
      $exception_type: 'RangeError',
      $exception_message: 'boom-async',
      handled: false,
    });
  });

  it('caps the early exception buffer at fifty entries', () => {
    for (let i = 0; i < 75; i += 1) {
      reportHandledException(new Error(`loop-${i}`));
    }
    expect(requests).toHaveLength(0);

    setExceptionTrackingContext({
      apiKey: 'phc_test',
      host: 'https://us.i.posthog.com',
      distinctId: 'user-loop',
    });

    const bodies = requestBodies();
    expect(bodies).toHaveLength(50);
    expect(recordField(bodies[0] ?? {}, 'properties').$exception_message).toBe(
      'loop-25',
    );
    expect(recordField(bodies[49] ?? {}, 'properties').$exception_message).toBe(
      'loop-74',
    );
  });
});
