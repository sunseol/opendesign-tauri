import {
  isRecord,
  objectScopeKey,
  parseObjectScopePayload,
} from './object-relay-parse';
import { base64UrlEncode } from './object-relay-token';
import {
  MAX_TOKEN_OBJECTS,
  OBJECT_SCOPE_TTL_SECONDS,
  type ObjectClass,
  type ObjectRelayEnv,
  type ObjectScopeBinding,
  type ObjectUploadScopeObject,
} from './object-relay-types';

const MANIFEST_KEYS = [
  'attachment_manifest',
  'artifact_manifest',
  'input_text_snapshot_manifest',
] as const;

function isAllowedObjectClass(value: unknown): value is ObjectClass {
  return (
    value === 'attachment' ||
    value === 'artifact' ||
    value === 'input_text_snapshot'
  );
}

export function objectAuthorityRegistryKey(
  clientId: string,
  projectId: string,
  runId: string,
): string {
  const raw = JSON.stringify({ clientId, projectId, runId });
  return `trace-object-scope:${base64UrlEncode(raw)}`;
}

function traceCreateEventIds(value: unknown): Set<string> {
  const ids = new Set<string>();
  if (!isRecord(value) || !Array.isArray(value.batch)) return ids;
  for (const event of value.batch) {
    if (
      isRecord(event) &&
      event.type === 'trace-create' &&
      typeof event.id === 'string' &&
      event.id.length > 0
    ) {
      ids.add(event.id);
    }
  }
  return ids;
}

function eventResultIds(value: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(value)) return ids;
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id.length === 0) continue;
    ids.add(item.id);
  }
  return ids;
}

export function acceptedTraceCreateEventIds(
  responseBody: string,
  requestBody: unknown,
): Set<string> {
  const traceIds = traceCreateEventIds(requestBody);
  if (traceIds.size === 0 || !responseBody) return traceIds;

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    return traceIds;
  }
  if (!isRecord(parsed)) return traceIds;

  const successes = eventResultIds(parsed.successes);
  if (successes.size > 0) {
    return new Set([...traceIds].filter((id) => successes.has(id)));
  }

  const errors = eventResultIds(parsed.errors);
  if (errors.size > 0) {
    return new Set([...traceIds].filter((id) => !errors.has(id)));
  }

  return traceIds;
}

function manifestObjectsFromMetadata(metadata: unknown): ObjectUploadScopeObject[] {
  if (!isRecord(metadata)) return [];

  const objects: ObjectUploadScopeObject[] = [];
  for (const key of MANIFEST_KEYS) {
    const entries = metadata[key];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!isRecord(entry)) continue;
      if (
        typeof entry.storage_ref !== 'string' ||
        !entry.storage_ref.startsWith('od://objects/') ||
        !isAllowedObjectClass(entry.object_class) ||
        typeof entry.size_bytes !== 'number' ||
        !Number.isFinite(entry.size_bytes) ||
        entry.size_bytes < 0 ||
        typeof entry.sha256 !== 'string' ||
        !/^sha256:[a-f0-9]{64}$/i.test(entry.sha256)
      ) {
        continue;
      }
      objects.push({
        storage_ref: entry.storage_ref,
        object_class: entry.object_class,
        size_bytes: Math.floor(entry.size_bytes),
        sha256: entry.sha256.toLowerCase(),
      });
    }
  }
  return objects;
}

function parseRegisteredScope(value: unknown): ObjectUploadScopeObject[] | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const scope = parseObjectScopePayload(value, MAX_TOKEN_OBJECTS);
  return scope.ok ? [...scope.value.objects] : null;
}

export async function registerObjectUploadScopes(
  env: Pick<ObjectRelayEnv, 'TRACE_OBJECT_SCOPE_KV'>,
  parsed: unknown,
  acceptedTraceEventIds: Set<string>,
): Promise<void> {
  const scopeKv = env.TRACE_OBJECT_SCOPE_KV;
  if (!scopeKv || !isRecord(parsed) || !Array.isArray(parsed.batch)) return;

  for (const event of parsed.batch) {
    if (!isRecord(event) || event.type !== 'trace-create' || !isRecord(event.body)) continue;
    if (typeof event.id !== 'string' || !acceptedTraceEventIds.has(event.id)) continue;

    const body = event.body;
    const metadata = body.metadata;
    const clientId = typeof body.userId === 'string' && body.userId.length > 0
      ? body.userId
      : null;
    const projectId = isRecord(metadata) &&
      typeof metadata.projectId === 'string' &&
      metadata.projectId.length > 0
      ? metadata.projectId
      : null;
    const runId = typeof body.id === 'string' && body.id.length > 0 ? body.id : null;
    if (!clientId || !projectId || !runId) continue;

    const objects = manifestObjectsFromMetadata(metadata);
    const parsedScope = parseObjectScopePayload(
      { version: 1, client_id: clientId, project_id: projectId, run_id: runId, objects },
      MAX_TOKEN_OBJECTS,
    );
    if (!parsedScope.ok) continue;

    await scopeKv.put(
      objectAuthorityRegistryKey(clientId, projectId, runId),
      JSON.stringify({
        version: 1,
        client_id: clientId,
        project_id: projectId,
        run_id: runId,
        objects: parsedScope.value.objects,
      }),
      { expirationTtl: OBJECT_SCOPE_TTL_SECONDS },
    );
  }
}

export async function loadRegisteredObjectScopes(
  scopeKv: ObjectScopeBinding,
  clientId: string,
  projectId: string,
  runId: string,
): Promise<ObjectUploadScopeObject[] | null> {
  const raw = await scopeKv.get(objectAuthorityRegistryKey(clientId, projectId, runId));
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return parseRegisteredScope(parsed);
}

export function includesRegisteredObjectScopes(
  registeredObjects: readonly ObjectUploadScopeObject[],
  requestedObjects: readonly ObjectUploadScopeObject[],
): boolean {
  const registeredByKey = new Map(
    registeredObjects.map((object) => [objectScopeKey(object), object]),
  );

  for (const object of requestedObjects) {
    const registered = registeredByKey.get(objectScopeKey(object));
    if (
      !registered ||
      registered.size_bytes !== object.size_bytes ||
      registered.sha256.toLowerCase() !== object.sha256.toLowerCase()
    ) {
      return false;
    }
  }
  return true;
}
