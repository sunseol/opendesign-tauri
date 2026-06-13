import {
  DEFAULT_OBJECT_BATCH_MAX_BYTES,
  DEFAULT_OBJECT_MAX_BYTES,
  type BuildTraceObjectManifestsOptions,
  type ObjectRelayAuthorizeObject,
  type ObjectRelayConfig,
  type ObjectRelayRequestObject,
  type RelayResult,
} from './trace-object-manifest-types.js';

const OBJECT_RELAY_MARKER_HEADER = 'X-Open-Design-Telemetry';
const OBJECT_RELAY_MARKER_VALUE = 'object-ingestion-v1';
const OBJECT_BATCH_MAX_COUNT = 100;

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function inferRelayUrl(env: NodeJS.ProcessEnv): string | null {
  const explicit = env.OPEN_DESIGN_OBJECT_RELAY_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const rawTelemetryRelayUrl = env.OPEN_DESIGN_TELEMETRY_RELAY_URL?.trim();
  if (!rawTelemetryRelayUrl) return null;
  const telemetryRelayUrl = rawTelemetryRelayUrl.replace(/\/+$/, '');
  try {
    const url = new URL(telemetryRelayUrl);
    if (!/\/api\/langfuse\/?$/u.test(url.pathname)) return null;
    url.pathname = url.pathname.replace(/\/api\/langfuse\/?$/u, '/api/objects/batch');
    return url.toString().replace(/\/+$/, '');
  } catch {
    const derived = telemetryRelayUrl.replace(/\/api\/langfuse\/?$/u, '/api/objects/batch');
    return derived === telemetryRelayUrl ? null : derived.replace(/\/+$/, '');
  }
}

function inferAuthorizeUrl(batchUrl: string): string {
  try {
    const url = new URL(batchUrl);
    url.pathname = url.pathname.replace(/\/api\/objects\/batch\/?$/u, '/api/objects/authorize');
    return url.toString().replace(/\/+$/, '');
  } catch {
    return batchUrl.replace(/\/api\/objects\/batch\/?$/u, '/api/objects/authorize');
  }
}

export function readObjectRelayConfig(env: NodeJS.ProcessEnv): ObjectRelayConfig | null {
  const url = inferRelayUrl(env);
  if (!url) return null;
  return {
    url,
    authorizeUrl: inferAuthorizeUrl(url),
    timeoutMs: parsePositiveInt(
      env.OPEN_DESIGN_OBJECT_RELAY_TIMEOUT_MS ?? env.OPEN_DESIGN_TELEMETRY_TIMEOUT_MS,
      10_000,
    ),
    objectMaxBytes: parsePositiveInt(env.OPEN_DESIGN_OBJECT_MAX_BYTES, DEFAULT_OBJECT_MAX_BYTES),
    objectBatchMaxBytes: parsePositiveInt(
      env.OPEN_DESIGN_OBJECT_BATCH_MAX_BYTES ?? env.TRACE_OBJECT_BATCH_MAX_BYTES,
      DEFAULT_OBJECT_BATCH_MAX_BYTES,
    ),
  };
}

function buildObjectBatchBody(
  opts: BuildTraceObjectManifestsOptions,
  objects: ObjectRelayRequestObject[],
  uploadToken: string,
): string {
  return JSON.stringify({
    client_id: opts.installationId ?? undefined,
    project_id: opts.projectId,
    run_id: opts.runId,
    upload_token: uploadToken,
    objects,
  });
}

function buildAuthorizeBody(
  opts: BuildTraceObjectManifestsOptions,
  objects: ObjectRelayAuthorizeObject[],
): string {
  return JSON.stringify({
    client_id: opts.installationId ?? undefined,
    project_id: opts.projectId,
    run_id: opts.runId,
    objects,
  });
}

async function authorizeObjects(
  config: ObjectRelayConfig,
  opts: BuildTraceObjectManifestsOptions,
  objects: ObjectRelayAuthorizeObject[],
): Promise<string | null> {
  try {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const response = await fetchImpl(config.authorizeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [OBJECT_RELAY_MARKER_HEADER]: OBJECT_RELAY_MARKER_VALUE,
      },
      body: buildAuthorizeBody(opts, objects),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) return null;
    const parsed = await response.json().catch(() => null);
    if (!parsed || typeof parsed !== 'object') return null;
    const token = (parsed as { upload_token?: unknown }).upload_token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

function splitObjectBatches(
  config: ObjectRelayConfig,
  opts: BuildTraceObjectManifestsOptions,
  objects: ObjectRelayRequestObject[],
  uploadToken: string,
): { batches: ObjectRelayRequestObject[][]; overflowResults: RelayResult[] } {
  const batches: ObjectRelayRequestObject[][] = [];
  const overflowResults: RelayResult[] = [];
  let current: ObjectRelayRequestObject[] = [];

  for (const object of objects) {
    if (byteLength(buildObjectBatchBody(opts, [object], uploadToken)) > config.objectBatchMaxBytes) {
      overflowResults.push({
        storage_ref: object.storage_ref,
        status: 'unavailable',
        reason: 'object_batch_too_large',
      });
      continue;
    }

    const next = [...current, object];
    if (
      current.length > 0 &&
      (next.length > OBJECT_BATCH_MAX_COUNT ||
        byteLength(buildObjectBatchBody(opts, next, uploadToken)) > config.objectBatchMaxBytes)
    ) {
      batches.push(current);
      current = [object];
    } else {
      current = next;
    }
  }

  if (current.length > 0) batches.push(current);
  return { batches, overflowResults };
}

async function postObjects(
  config: ObjectRelayConfig,
  opts: BuildTraceObjectManifestsOptions,
  objects: ObjectRelayRequestObject[],
  uploadToken: string,
): Promise<RelayResult[]> {
  try {
    const response = await (opts.fetchImpl ?? fetch)(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [OBJECT_RELAY_MARKER_HEADER]: OBJECT_RELAY_MARKER_VALUE,
      },
      body: buildObjectBatchBody(opts, objects, uploadToken),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) {
      return objects.map((object) => ({
        storage_ref: object.storage_ref,
        status: 'unavailable',
        reason: `relay_${response.status}`,
      }));
    }
    const parsed = await response.json().catch(() => null);
    const results = parsed && typeof parsed === 'object'
      ? (parsed as { objects?: unknown }).objects
      : undefined;
    return Array.isArray(results) ? results as RelayResult[] : objects.map((object) => ({
      storage_ref: object.storage_ref,
      status: 'unavailable',
      reason: 'relay_invalid_response',
    }));
  } catch {
    return objects.map((object) => ({
      storage_ref: object.storage_ref,
      status: 'unavailable',
      reason: 'relay_network_error',
    }));
  }
}

export async function postObjectBatch(
  config: ObjectRelayConfig,
  opts: BuildTraceObjectManifestsOptions,
  objects: ObjectRelayRequestObject[],
): Promise<RelayResult[]> {
  if (objects.length === 0) return [];
  const token = await authorizeObjects(config, opts, objects.map((object) => ({
    storage_ref: object.storage_ref,
    object_class: object.object_class,
    size_bytes: object.size_bytes,
    sha256: object.sha256,
  })));
  if (!token) {
    return objects.map((object) => ({
      storage_ref: object.storage_ref,
      status: 'unavailable',
      reason: 'relay_authorization_failed',
    }));
  }

  const { batches, overflowResults } = splitObjectBatches(config, opts, objects, token);
  const batchResults: RelayResult[] = [];
  for (const batch of batches) {
    batchResults.push(...await postObjects(config, opts, batch, token));
  }
  return [...batchResults, ...overflowResults];
}
