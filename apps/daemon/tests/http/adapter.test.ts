import type { Server } from 'node:http';
import express from 'express';
import { describe, expect, it } from 'vitest';
import { createApiError } from '@open-design/contracts';
import {
  defineJsonRoute,
  err,
  mountJsonRoute,
  ok,
  validationError,
} from '../../src/http/index.js';

interface StartedServer {
  baseUrl: string;
  port: number;
  server: Server;
}

async function listen(app: express.Express): Promise<StartedServer> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => {
    server.once('listening', resolve);
  });
  const address = server.address();
  if (address == null || typeof address === 'string') {
    throw new Error('test server did not expose a TCP port');
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    port: address.port,
    server,
  };
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

describe('http adapter', () => {
  it('parses request input and returns the success payload', async () => {
    const app = express();
    const adapter = { resolvedPortRef: { current: 0 } };
    const route = defineJsonRoute<{ id: string; value: string }, { echoed: string }, unknown>({
      method: 'get',
      path: '/echo/:id',
      parse: (raw) => ok({
        id: raw.params.id ?? '',
        value: typeof raw.query.value === 'string' ? raw.query.value : '',
      }),
      handle: (input) => ok({ echoed: `${input.id}:${input.value}` }),
    });
    mountJsonRoute(app, route, {}, adapter);
    const started = await listen(app);
    adapter.resolvedPortRef.current = started.port;
    try {
      const response = await fetch(`${started.baseUrl}/echo/item-1?value=hi`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ echoed: 'item-1:hi' });
    } finally {
      await close(started.server);
    }
  });

  it('returns validation failures as shared API errors', async () => {
    const app = express();
    const adapter = { resolvedPortRef: { current: 0 } };
    const route = defineJsonRoute<never, unknown, unknown>({
      method: 'post',
      path: '/missing',
      parse: () => err(validationError('invalid input', [{ path: 'name', message: 'required' }])),
      handle: () => ok({}),
    });
    mountJsonRoute(app, route, {}, adapter);
    const started = await listen(app);
    adapter.resolvedPortRef.current = started.port;
    try {
      const response = await fetch(`${started.baseUrl}/missing`, { method: 'POST' });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: {
          code: 'BAD_REQUEST',
          message: 'invalid input',
          details: {
            kind: 'validation',
            issues: [{ path: 'name', message: 'required' }],
          },
        },
      });
    } finally {
      await close(started.server);
    }
  });

  it('maps domain errors to status codes', async () => {
    const app = express();
    const adapter = { resolvedPortRef: { current: 0 } };
    const route = defineJsonRoute<void, unknown, unknown>({
      method: 'get',
      path: '/missing',
      parse: () => ok(undefined),
      handle: () => err(createApiError('NOT_FOUND', 'gone')),
    });
    mountJsonRoute(app, route, {}, adapter);
    const started = await listen(app);
    adapter.resolvedPortRef.current = started.port;
    try {
      const response = await fetch(`${started.baseUrl}/missing`);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'gone' },
      });
    } finally {
      await close(started.server);
    }
  });

  it('blocks cross-origin requests when a route requires same-origin access', async () => {
    const app = express();
    const adapter = { resolvedPortRef: { current: 0 } };
    const route = defineJsonRoute<void, { secret: number }, unknown>({
      method: 'get',
      path: '/secret',
      requireSameOrigin: true,
      parse: () => ok(undefined),
      handle: () => ok({ secret: 42 }),
    });
    mountJsonRoute(app, route, {}, adapter);
    const started = await listen(app);
    adapter.resolvedPortRef.current = started.port;
    try {
      const response = await fetch(`${started.baseUrl}/secret`, {
        headers: { Origin: 'http://evil.example' },
      });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: { code: 'FORBIDDEN', message: 'cross-origin request rejected' },
      });
    } finally {
      await close(started.server);
    }
  });

  it('catches thrown handler errors as internal API errors', async () => {
    const app = express();
    const adapter = { resolvedPortRef: { current: 0 } };
    const route = defineJsonRoute<void, unknown, unknown>({
      method: 'get',
      path: '/boom',
      parse: () => ok(undefined),
      handle: () => {
        throw new Error('boom');
      },
    });
    mountJsonRoute(app, route, {}, adapter);
    const started = await listen(app);
    adapter.resolvedPortRef.current = started.port;
    try {
      const response = await fetch(`${started.baseUrl}/boom`);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: { code: 'INTERNAL_ERROR', message: 'boom' },
      });
    } finally {
      await close(started.server);
    }
  });

  it('passes dependencies through to handlers', async () => {
    interface Deps {
      tag: string;
    }
    const app = express();
    const adapter = { resolvedPortRef: { current: 0 } };
    const route = defineJsonRoute<void, { tag: string }, Deps>({
      method: 'get',
      path: '/deps',
      parse: () => ok(undefined),
      handle: (_input, deps) => ok({ tag: deps.tag }),
    });
    mountJsonRoute(app, route, { tag: 'injected' }, adapter);
    const started = await listen(app);
    adapter.resolvedPortRef.current = started.port;
    try {
      const response = await fetch(`${started.baseUrl}/deps`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ tag: 'injected' });
    } finally {
      await close(started.server);
    }
  });
});
