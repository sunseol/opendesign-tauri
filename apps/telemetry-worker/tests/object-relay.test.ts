import { describe, expect, it, vi } from 'vitest';

import worker from '../src/index';
import {
  base64,
  env,
  makeObjectAuthorizeRequest,
  makeObjectRelayRequest,
  makePutSpy,
  makeRateLimiter,
  makeScopeKv,
  makeSignedObjectRelayRequest,
  objectUploadSecret,
  sha256,
} from './object-relay-helpers';

describe('telemetry worker object relay', () => {
  it('reports object relay unconfigured when upload authority is absent', async () => {
    const response = await worker.fetch(new Request('https://telemetry.open-design.ai/health'), {
      TRACE_OBJECT_BUCKET: { put: vi.fn(async () => ({})) },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      objectRelayConfigured: false,
    });
  });

  it('rejects object batches without upload authority before reading the body', async () => {
    const request = makeObjectRelayRequest('object body should not be read');
    const textSpy = vi.spyOn(request, 'text').mockRejectedValue(
      new Error('object body should not be read'),
    );

    const response = await worker.fetch(request, {
      ...env,
      TRACE_OBJECT_BUCKET: { put: vi.fn(async () => ({})) },
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'object relay upload authority is not configured',
    });
    expect(textSpy).not.toHaveBeenCalled();
  });

  it('rate limits object batches by IP before reading the body', async () => {
    const put = makePutSpy();
    const limiter = makeRateLimiter(false);
    const request = makeObjectRelayRequest('object body should not be read', {
      'CF-Connecting-IP': '203.0.113.10',
    });
    const textSpy = vi.spyOn(request, 'text').mockRejectedValue(
      new Error('object body should not be read'),
    );

    const response = await worker.fetch(request, {
      ...env,
      TELEMETRY_IP_RATE_LIMITER: limiter,
      TRACE_OBJECT_BUCKET: { put },
      TRACE_OBJECT_UPLOAD_SECRET: 'object-upload-secret',
    });

    expect(response.status).toBe(429);
    expect(limiter.limit).toHaveBeenCalledWith({ key: 'ip:203.0.113.10' });
    expect(textSpy).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects marker-only object batches without upload tokens', async () => {
    const put = makePutSpy();
    const response = await worker.fetch(
      makeObjectRelayRequest(JSON.stringify({
        client_id: 'installation-1',
        project_id: 'proj-1',
        run_id: 'run-1',
        objects: [],
      })),
      {
        ...env,
        TRACE_OBJECT_BUCKET: { put },
        TRACE_OBJECT_UPLOAD_SECRET: 'object-upload-secret',
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'body.upload_token must be a string',
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects object authorization metadata without registered telemetry scope', async () => {
    const put = makePutSpy();
    const scopeKv = makeScopeKv();
    const storageRef =
      'od://objects/workspaces/unknown/projects/proj-1/runs/run-1/attachment/att-1/brief.txt';

    const response = await worker.fetch(
      makeObjectAuthorizeRequest({
        content: 'hello object',
        storageRef,
      }),
      {
        ...env,
        TRACE_OBJECT_BUCKET: { put },
        TRACE_OBJECT_SCOPE_KV: scopeKv,
        TRACE_OBJECT_UPLOAD_SECRET: objectUploadSecret,
      },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'object upload authority is not registered',
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('stores signed object batches through the R2 binding', async () => {
    const put = makePutSpy();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const storageRef =
      'od://objects/workspaces/unknown/projects/proj-1/runs/run-1/attachment/att-1/brief.txt';

    const response = await worker.fetch(
      makeSignedObjectRelayRequest({
        content: 'hello object',
        storageRef,
      }),
      {
        ...env,
        TRACE_OBJECT_BUCKET: { put },
        TRACE_OBJECT_PREFIX: 'observability',
        TRACE_OBJECT_UPLOAD_SECRET: objectUploadSecret,
      },
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0]?.[0]).toBe(
      'observability/workspaces/unknown/projects/proj-1/runs/run-1/attachment/att-1/brief.txt',
    );
    const body = await response.json();
    expect(body).toEqual({
      objects: [
        {
          storage_ref: storageRef,
          status: 'available',
          size_bytes: 12,
          sha256: `sha256:${sha256('hello object')}`,
        },
      ],
    });

    fetchSpy.mockRestore();
  });

  it('reports signed-scope misses without writing to R2', async () => {
    const put = makePutSpy();
    const storageRef =
      'od://objects/workspaces/unknown/projects/proj-1/runs/run-1/attachment/att-2/brief.txt';
    const tokenStorageRef =
      'od://objects/workspaces/unknown/projects/proj-1/runs/run-1/attachment/att-1/brief.txt';

    const response = await worker.fetch(
      makeSignedObjectRelayRequest({
        content: 'hello object',
        storageRef,
        tokenStorageRef,
      }),
      {
        ...env,
        TRACE_OBJECT_BUCKET: { put },
        TRACE_OBJECT_UPLOAD_SECRET: objectUploadSecret,
      },
    );

    expect(response.status).toBe(200);
    expect(put).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      objects: [
        {
          storage_ref: storageRef,
          status: 'unavailable',
          reason: 'unauthorized_object',
        },
      ],
    });
  });
});
