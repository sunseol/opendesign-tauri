import { describe, expect, it, vi } from 'vitest';

import worker, { type Env } from '../src/index';

const env: Env = {
  LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
  LANGFUSE_SECRET_KEY: 'sk-lf-test',
  LANGFUSE_BASE_URL: 'https://us.cloud.langfuse.com',
};

function makeRateLimiter(success: boolean) {
  return {
    limit: vi.fn(async () => ({ success })),
  };
}

function makeObjectRelayRequest(
  body: string,
  headers: Record<string, string> = {},
): Request {
  return new Request('https://telemetry.open-design.ai/api/objects/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Open-Design-Telemetry': 'object-ingestion-v1',
      ...headers,
    },
    body,
  });
}

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
    const put = vi.fn(async () => ({}));
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
    const put = vi.fn(async () => ({}));
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
});
