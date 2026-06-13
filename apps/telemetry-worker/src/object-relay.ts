import { decodeBase64, sha256Hex } from './object-relay-crypto';
import {
  keyFromStorageRef,
  normalizeObjectPrefix,
  objectScopeKey,
  parseObjectBatchBody,
  parseObjectScopePayload,
  parsePositiveInt,
} from './object-relay-parse';
import {
  includesRegisteredObjectScopes,
  loadRegisteredObjectScopes,
} from './object-relay-scope';
import { signUploadToken, verifyUploadToken } from './object-relay-token';
import {
  DEFAULT_OBJECT_BATCH_MAX_BYTES,
  DEFAULT_OBJECT_MAX_BYTES,
  MAX_TOKEN_OBJECTS,
  OBJECT_UPLOAD_TOKEN_TTL_SECONDS,
  type ObjectBatchObject,
  type ObjectRelayEnv,
  type RateLimitBinding,
} from './object-relay-types';

export type { ObjectRelayEnv, RateLimitBinding } from './object-relay-types';

const OBJECT_RELAY_MARKER_HEADER = 'X-Open-Design-Telemetry';
const OBJECT_RELAY_MARKER_VALUE = 'object-ingestion-v1';
const OBJECT_AUTHORIZE_MAX_BYTES = 1024 * 1024;

type ObjectRelayResult = Record<string, unknown>;

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  });
}

export function hasObjectUploadAuthority(env: ObjectRelayEnv): boolean {
  return Boolean(env.TRACE_OBJECT_BUCKET && env.TRACE_OBJECT_UPLOAD_SECRET?.trim());
}

export function hasObjectAuthorizeAuthority(env: ObjectRelayEnv): boolean {
  return hasObjectUploadAuthority(env) && Boolean(env.TRACE_OBJECT_SCOPE_KV);
}

function bodySizeBytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

async function enforceClientRateLimit(
  clientId: string,
  limiter?: RateLimitBinding,
): Promise<Response | null> {
  if (!limiter) return null;

  const { success } = await limiter.limit({ key: `client:${clientId.slice(0, 200)}` });
  return success ? null : jsonResponse(429, { error: 'rate limit exceeded' });
}

async function enforceIpRateLimit(request: Request, limiter?: RateLimitBinding): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP')?.trim();
  if (!ip || !limiter) return null;

  const { success } = await limiter.limit({ key: `ip:${ip}` });
  return success ? null : jsonResponse(429, { error: 'rate limit exceeded' });
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<string | Response> {
  const contentLength = request.headers.get('content-length');
  if (contentLength != null && Number(contentLength) > maxBytes) {
    return jsonResponse(413, { error: 'payload too large' });
  }

  const text = await request.text();
  if (bodySizeBytes(text) > maxBytes) {
    return jsonResponse(413, { error: 'payload too large' });
  }
  return text;
}

function unavailableResult(
  object: Pick<ObjectBatchObject, 'storage_ref'>,
  reason: string,
  extra: Record<string, unknown> = {},
): ObjectRelayResult {
  return {
    storage_ref: object.storage_ref,
    status: 'unavailable',
    reason,
    ...extra,
  };
}

export async function handleObjectAuthorizeRequest(
  request: Request,
  env: ObjectRelayEnv,
): Promise<Response> {
  if (request.headers.get(OBJECT_RELAY_MARKER_HEADER) !== OBJECT_RELAY_MARKER_VALUE) {
    return jsonResponse(403, { error: 'missing object client marker' });
  }

  if (!hasObjectAuthorizeAuthority(env)) {
    return jsonResponse(503, { error: 'object relay upload authority is not configured' });
  }
  const scopeKv = env.TRACE_OBJECT_SCOPE_KV;
  const uploadSecret = env.TRACE_OBJECT_UPLOAD_SECRET?.trim();
  if (!scopeKv || !uploadSecret) {
    return jsonResponse(503, { error: 'object relay upload authority is not configured' });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonResponse(415, { error: 'content-type must be application/json' });
  }

  const ipRateLimitResponse = await enforceIpRateLimit(request, env.TELEMETRY_IP_RATE_LIMITER);
  if (ipRateLimitResponse) return ipRateLimitResponse;

  const rawBody = await readBoundedBody(request, OBJECT_AUTHORIZE_MAX_BYTES);
  if (rawBody instanceof Response) return rawBody;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return jsonResponse(400, { error: 'invalid JSON' });
  }

  const scope = parseObjectScopePayload(parsed, MAX_TOKEN_OBJECTS);
  if (!scope.ok) return jsonResponse(400, { error: scope.error });

  const clientRateLimitResponse = await enforceClientRateLimit(
    scope.value.client_id,
    env.TELEMETRY_CLIENT_RATE_LIMITER,
  );
  if (clientRateLimitResponse) return clientRateLimitResponse;

  const registeredObjects = await loadRegisteredObjectScopes(
    scopeKv,
    scope.value.client_id,
    scope.value.project_id,
    scope.value.run_id,
  );
  if (!registeredObjects) {
    return jsonResponse(403, { error: 'object upload authority is not registered' });
  }
  if (!includesRegisteredObjectScopes(registeredObjects, scope.value.objects)) {
    return jsonResponse(403, { error: 'object upload authority scope mismatch' });
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + OBJECT_UPLOAD_TOKEN_TTL_SECONDS;
  const uploadToken = await signUploadToken(uploadSecret, {
    version: 1,
    client_id: scope.value.client_id,
    project_id: scope.value.project_id,
    run_id: scope.value.run_id,
    exp,
    objects: scope.value.objects,
  });

  return jsonResponse(200, {
    upload_token: uploadToken,
    expires_at: new Date(exp * 1000).toISOString(),
  });
}

export async function handleObjectBatchRequest(
  request: Request,
  env: ObjectRelayEnv,
): Promise<Response> {
  if (request.headers.get(OBJECT_RELAY_MARKER_HEADER) !== OBJECT_RELAY_MARKER_VALUE) {
    return jsonResponse(403, { error: 'missing object ingestion client marker' });
  }

  if (!hasObjectUploadAuthority(env)) {
    return jsonResponse(503, { error: 'object relay upload authority is not configured' });
  }
  const objectBucket = env.TRACE_OBJECT_BUCKET;
  const uploadSecret = env.TRACE_OBJECT_UPLOAD_SECRET?.trim();
  if (!objectBucket || !uploadSecret) {
    return jsonResponse(503, { error: 'object relay upload authority is not configured' });
  }

  const rateLimitResponse = await enforceIpRateLimit(request, env.TELEMETRY_IP_RATE_LIMITER);
  if (rateLimitResponse) return rateLimitResponse;

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonResponse(415, { error: 'content-type must be application/json' });
  }

  const batchMaxBytes = parsePositiveInt(
    env.TRACE_OBJECT_BATCH_MAX_BYTES,
    DEFAULT_OBJECT_BATCH_MAX_BYTES,
  );
  const rawBody = await readBoundedBody(request, batchMaxBytes);
  if (rawBody instanceof Response) return rawBody;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return jsonResponse(400, { error: 'invalid JSON' });
  }

  const batch = parseObjectBatchBody(parsed);
  if (!batch.ok) return jsonResponse(400, { error: batch.error });

  const tokenPayload = await verifyUploadToken(uploadSecret, batch.value.upload_token);
  if (!tokenPayload) return jsonResponse(403, { error: 'invalid object upload authority' });
  if (
    batch.value.client_id !== tokenPayload.client_id ||
    batch.value.project_id !== tokenPayload.project_id ||
    batch.value.run_id !== tokenPayload.run_id
  ) {
    return jsonResponse(403, { error: 'object upload authority scope mismatch' });
  }

  const clientRateLimitResponse = await enforceClientRateLimit(
    batch.value.client_id,
    env.TELEMETRY_CLIENT_RATE_LIMITER,
  );
  if (clientRateLimitResponse) return clientRateLimitResponse;

  const allowedByKey = new Map(
    tokenPayload.objects.map((object) => [objectScopeKey(object), object]),
  );
  const objectMaxBytes = parsePositiveInt(env.TRACE_OBJECT_MAX_BYTES, DEFAULT_OBJECT_MAX_BYTES);
  const prefix = normalizeObjectPrefix(env.TRACE_OBJECT_PREFIX);
  const results: ObjectRelayResult[] = [];

  for (const object of batch.value.objects) {
    const authorized = allowedByKey.get(objectScopeKey(object));
    if (!authorized) {
      results.push(unavailableResult(object, 'unauthorized_object'));
      continue;
    }

    const key = keyFromStorageRef(object.storage_ref, prefix);
    if (!key) {
      results.push(unavailableResult(object, 'invalid_storage_ref'));
      continue;
    }

    const bytes = decodeBase64(object.content_base64);
    if (!bytes) {
      results.push(unavailableResult(object, 'invalid_base64'));
      continue;
    }
    if (bytes.byteLength > objectMaxBytes) {
      results.push(unavailableResult(object, 'object_too_large', {
        size_bytes: bytes.byteLength,
      }));
      continue;
    }

    const sha256 = `sha256:${await sha256Hex(bytes)}`;
    if (bytes.byteLength !== authorized.size_bytes || sha256 !== authorized.sha256) {
      results.push(unavailableResult(object, 'object_authority_mismatch', {
        size_bytes: bytes.byteLength,
        sha256,
      }));
      continue;
    }

    await objectBucket.put(key, bytes, {
      httpMetadata: {
        contentType: object.mime ?? 'application/octet-stream',
      },
      customMetadata: {
        storage_ref: object.storage_ref,
        sha256,
      },
    });
    results.push({
      storage_ref: object.storage_ref,
      status: 'available',
      size_bytes: bytes.byteLength,
      sha256,
    });
  }

  return jsonResponse(200, { objects: results });
}
