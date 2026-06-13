import { describe, expect, it, vi } from 'vitest';

import worker, { type Env } from '../src/index';
import {
  makeObjectAuthorizeRequest,
  makePutSpy,
  makeScopeKv,
  objectUploadSecret,
  sha256,
} from './object-relay-helpers';

const env: Env = {
  LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
  LANGFUSE_SECRET_KEY: 'sk-lf-test',
  LANGFUSE_BASE_URL: 'https://us.cloud.langfuse.com',
};

function makeRequest(body: unknown): Request {
  return new Request('https://telemetry.open-design.ai/api/langfuse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Open-Design-Telemetry': 'langfuse-ingestion-v1',
    },
    body: JSON.stringify(body),
  });
}

describe('telemetry worker object relay registration', () => {
  it('registers accepted trace object scopes and issues upload tokens', async () => {
    const content = 'hello object';
    const storageRef =
      'od://objects/workspaces/unknown/projects/proj-1/runs/run-1/artifact/art-1/index.html';
    const scopeKv = makeScopeKv();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          successes: [{ id: 'trace-evt-1' }],
          errors: [{ id: 'span-evt-1', status: 400 }],
        }),
        { status: 207, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const traceResponse = await worker.fetch(
      makeRequest({
        batch: [
          {
            id: 'trace-evt-1',
            type: 'trace-create',
            timestamp: '2026-06-08T00:00:00.000Z',
            body: {
              id: 'run-1',
              name: 'open-design-turn',
              userId: 'installation-1',
              metadata: {
                projectId: 'proj-1',
                artifact_manifest: [
                  {
                    storage_ref: storageRef,
                    object_class: 'artifact',
                    size_bytes: content.length,
                    sha256: `sha256:${sha256(content)}`,
                  },
                ],
              },
            },
          },
          {
            id: 'span-evt-1',
            type: 'span-create',
            timestamp: '2026-06-08T00:00:00.000Z',
            body: { id: 'span-1', traceId: 'run-1', name: 'agent-call' },
          },
        ],
      }),
      {
        ...env,
        TRACE_OBJECT_BUCKET: { put: makePutSpy() },
        TRACE_OBJECT_SCOPE_KV: scopeKv,
        TRACE_OBJECT_UPLOAD_SECRET: objectUploadSecret,
      },
    );

    expect(traceResponse.status).toBe(207);
    expect(scopeKv.put).toHaveBeenCalledTimes(1);
    expect(scopeKv.put.mock.calls[0]?.[2]).toEqual({ expirationTtl: 600 });

    const response = await worker.fetch(
      makeObjectAuthorizeRequest({
        content,
        objectClass: 'artifact',
        storageRef,
      }),
      {
        ...env,
        TRACE_OBJECT_BUCKET: { put: makePutSpy() },
        TRACE_OBJECT_SCOPE_KV: scopeKv,
        TRACE_OBJECT_UPLOAD_SECRET: objectUploadSecret,
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      upload_token: expect.stringMatching(/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/),
      expires_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });

    fetchSpy.mockRestore();
  });

  it('does not register object scopes for rejected trace-create events', async () => {
    const scopeKv = makeScopeKv();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ successes: [], errors: [{ id: 'trace-evt-1', status: 400 }] }),
        { status: 207, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await worker.fetch(
      makeRequest({
        batch: [
          {
            id: 'trace-evt-1',
            type: 'trace-create',
            timestamp: '2026-06-08T00:00:00.000Z',
            body: {
              id: 'run-1',
              name: 'open-design-turn',
              userId: 'installation-1',
              metadata: {
                projectId: 'proj-1',
                attachment_manifest: [
                  {
                    storage_ref: 'od://objects/workspaces/unknown/projects/proj-1/runs/run-1/attachment/att-1/brief.txt',
                    object_class: 'attachment',
                    size_bytes: 12,
                    sha256: `sha256:${sha256('hello object')}`,
                  },
                ],
              },
            },
          },
        ],
      }),
      {
        ...env,
        TRACE_OBJECT_BUCKET: { put: makePutSpy() },
        TRACE_OBJECT_SCOPE_KV: scopeKv,
        TRACE_OBJECT_UPLOAD_SECRET: objectUploadSecret,
      },
    );

    expect(response.status).toBe(207);
    expect(scopeKv.put).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
