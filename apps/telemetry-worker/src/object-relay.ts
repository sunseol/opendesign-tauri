const OBJECT_RELAY_MARKER_HEADER = 'X-Open-Design-Telemetry';
const OBJECT_RELAY_MARKER_VALUE = 'object-ingestion-v1';

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

  return jsonResponse(501, { error: 'object relay upload is not enabled' });
}
