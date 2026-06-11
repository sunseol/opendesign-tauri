import type http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer } from '../src/server.js';

describe('startServer HTTP keep-alive tuning', () => {
  let server: http.Server;

  beforeAll(async () => {
    const started = await startServer({ port: 0, returnServer: true }) as {
      url: string;
      server: http.Server;
    };
    server = started.server;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('widens keepAliveTimeout above the in-band SSE keepalive interval', () => {
    expect(server.keepAliveTimeout).toBeGreaterThanOrEqual(60_000);
  });

  it('keeps headersTimeout above keepAliveTimeout per Node convention', () => {
    expect(server.headersTimeout).toBeGreaterThan(server.keepAliveTimeout);
  });
});
