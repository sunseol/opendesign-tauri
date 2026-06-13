import { createHash, createHmac } from 'node:crypto';
import { vi } from 'vitest';

import type { Env } from '../src/index';
import type {
  ObjectClass,
  ObjectScopeBinding,
  R2BucketBinding,
} from '../src/object-relay-types';

export const env: Env = {
  LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
  LANGFUSE_SECRET_KEY: 'sk-lf-test',
  LANGFUSE_BASE_URL: 'https://us.cloud.langfuse.com',
};

export const objectUploadSecret = 'object-upload-secret';

type R2PutArgs = Parameters<R2BucketBinding['put']>;

export function makePutSpy() {
  return vi.fn(async (..._args: R2PutArgs) => ({}));
}

export function makeRateLimiter(success: boolean) {
  return {
    limit: vi.fn(async () => ({ success })),
  };
}

export function makeScopeKv(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    put: vi.fn(async (
      key: string,
      value: string,
      _options?: { expirationTtl?: number },
    ) => {
      values.set(key, value);
    }),
  } satisfies ObjectScopeBinding;
}

export function makeObjectRelayRequest(
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

export function makeObjectAuthorizeRequest(options: {
  readonly content: string;
  readonly storageRef: string;
  readonly objectClass?: ObjectClass;
}): Request {
  const objectClass = options.objectClass ?? 'attachment';
  return new Request('https://telemetry.open-design.ai/api/objects/authorize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Open-Design-Telemetry': 'object-ingestion-v1',
    },
    body: JSON.stringify({
      client_id: 'installation-1',
      project_id: 'proj-1',
      run_id: 'run-1',
      objects: [
        {
          storage_ref: options.storageRef,
          object_class: objectClass,
          size_bytes: new TextEncoder().encode(options.content).byteLength,
          sha256: `sha256:${sha256(options.content)}`,
        },
      ],
    }),
  });
}

export function base64(value: string): string {
  return btoa(value);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function uploadToken(scope: Record<string, unknown>): string {
  const payload = base64Url(JSON.stringify({
    version: 1,
    exp: Math.floor(Date.now() / 1000) + 300,
    ...scope,
  }));
  const signature = createHmac('sha256', objectUploadSecret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export function makeSignedObjectRelayRequest(options: {
  readonly content: string;
  readonly storageRef: string;
  readonly tokenStorageRef?: string;
}): Request {
  const tokenStorageRef = options.tokenStorageRef ?? options.storageRef;
  return makeObjectRelayRequest(JSON.stringify({
    client_id: 'installation-1',
    project_id: 'proj-1',
    run_id: 'run-1',
    upload_token: uploadToken({
      client_id: 'installation-1',
      project_id: 'proj-1',
      run_id: 'run-1',
      objects: [
        {
          storage_ref: tokenStorageRef,
          object_class: 'attachment',
          size_bytes: new TextEncoder().encode(options.content).byteLength,
          sha256: `sha256:${sha256(options.content)}`,
        },
      ],
    }),
    objects: [
      {
        storage_ref: options.storageRef,
        object_class: 'attachment',
        mime: 'text/plain',
        content_base64: base64(options.content),
      },
    ],
  }));
}
