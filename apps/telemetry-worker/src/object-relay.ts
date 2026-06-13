const OBJECT_RELAY_MARKER_HEADER = 'X-Open-Design-Telemetry';
const OBJECT_RELAY_MARKER_VALUE = 'object-ingestion-v1';
const OBJECT_BATCH_MAX_BYTES = 20 * 1024 * 1024;

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface R2BucketBinding {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream,
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
}

export interface ObjectRelayEnv {
  TRACE_OBJECT_BUCKET?: R2BucketBinding;
  TRACE_OBJECT_UPLOAD_SECRET?: string;
  TELEMETRY_IP_RATE_LIMITER?: RateLimitBinding;
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function bodySizeBytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

async function enforceIpRateLimit(request: Request, env: ObjectRelayEnv): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP')?.trim();
  if (!ip || !env.TELEMETRY_IP_RATE_LIMITER) return null;

  const { success } = await env.TELEMETRY_IP_RATE_LIMITER.limit({
    key: `ip:${ip}`,
  });
  return success ? null : jsonResponse(429, { error: 'rate limit exceeded' });
}

async function readBoundedBody(request: Request): Promise<string | Response> {
  const contentLength = request.headers.get('content-length');
  if (contentLength != null && Number(contentLength) > OBJECT_BATCH_MAX_BYTES) {
    return jsonResponse(413, { error: 'payload too large' });
  }

  const text = await request.text();
  if (bodySizeBytes(text) > OBJECT_BATCH_MAX_BYTES) {
    return jsonResponse(413, { error: 'payload too large' });
  }
  return text;
}

function validateObjectBody(value: unknown): string | null {
  if (!isRecord(value)) return 'body must be a JSON object';
  if (typeof value.client_id !== 'string' || value.client_id.length === 0) {
    return 'body.client_id must be a string';
  }
  if (typeof value.project_id !== 'string' || value.project_id.length === 0) {
    return 'body.project_id must be a string';
  }
  if (typeof value.run_id !== 'string' || value.run_id.length === 0) {
    return 'body.run_id must be a string';
  }
  if (typeof value.upload_token !== 'string' || value.upload_token.length === 0) {
    return 'body.upload_token must be a string';
  }
  if (!Array.isArray(value.objects)) return 'body.objects must be an array';
  if (value.objects.length === 0) return 'body.objects must not be empty';
  if (value.objects.length > 100) return 'body.objects has too many objects';
  return null;
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

  const rateLimitResponse = await enforceIpRateLimit(request, env);
  if (rateLimitResponse) return rateLimitResponse;

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonResponse(415, { error: 'content-type must be application/json' });
  }

  const rawBody = await readBoundedBody(request);
  if (rawBody instanceof Response) return rawBody;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return jsonResponse(400, { error: 'invalid JSON' });
  }

  const validationError = validateObjectBody(parsed);
  if (validationError != null) {
    return jsonResponse(400, { error: validationError });
  }

  return jsonResponse(501, { error: 'object relay upload is not enabled' });
}
