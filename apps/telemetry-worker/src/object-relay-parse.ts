import {
  DEFAULT_OBJECT_PREFIX,
  type ObjectBatchBody,
  type ObjectBatchObject,
  type ObjectClass,
  type ObjectUploadScopeObject,
  type ParseResult,
} from './object-relay-types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function normalizeObjectPrefix(raw: string | undefined): string {
  return (raw ?? DEFAULT_OBJECT_PREFIX).trim().replace(/^\/+|\/+$/g, '') || DEFAULT_OBJECT_PREFIX;
}

function isAllowedObjectClass(value: unknown): value is ObjectClass {
  return (
    value === 'attachment' ||
    value === 'artifact' ||
    value === 'input_text_snapshot'
  );
}

function safeObjectSegment(value: string): string {
  return value
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/[^A-Za-z0-9._=-]/g, '_'))
    .filter((segment) => segment !== '.' && segment !== '..')
    .join('/');
}

function expectedStorageRefPrefix(
  projectId: string,
  runId: string,
  objectClass: ObjectClass,
): string | null {
  const safeProject = safeObjectSegment(projectId);
  const safeRun = safeObjectSegment(runId);
  const safeClass = safeObjectSegment(objectClass);
  if (!safeProject || !safeRun || !safeClass) return null;
  return `od://objects/workspaces/unknown/projects/${safeProject}/runs/${safeRun}/${safeClass}/`;
}

export function keyFromStorageRef(storageRef: string, prefix: string): string | null {
  const marker = 'od://objects/';
  if (!storageRef.startsWith(marker)) return null;
  const suffix = safeObjectSegment(storageRef.slice(marker.length));
  if (!suffix) return null;
  return `${prefix}/${suffix}`;
}

export function objectScopeKey(
  object: Pick<ObjectUploadScopeObject, 'storage_ref' | 'object_class'>,
): string {
  return `${object.object_class}\n${object.storage_ref}`;
}

export function parseObjectScopePayload(value: unknown, maxObjects: number): ParseResult<{
  readonly client_id: string;
  readonly project_id: string;
  readonly run_id: string;
  readonly objects: readonly ObjectUploadScopeObject[];
}> {
  if (!isRecord(value)) return { ok: false, error: 'body must be a JSON object' };
  if (typeof value.client_id !== 'string' || value.client_id.length === 0) {
    return { ok: false, error: 'body.client_id must be a string' };
  }
  if (typeof value.project_id !== 'string' || value.project_id.length === 0) {
    return { ok: false, error: 'body.project_id must be a string' };
  }
  if (typeof value.run_id !== 'string' || value.run_id.length === 0) {
    return { ok: false, error: 'body.run_id must be a string' };
  }
  if (!Array.isArray(value.objects)) return { ok: false, error: 'body.objects must be an array' };
  if (value.objects.length === 0) return { ok: false, error: 'body.objects must not be empty' };
  if (value.objects.length > maxObjects) {
    return { ok: false, error: 'body.objects has too many objects' };
  }

  const objects: ObjectUploadScopeObject[] = [];
  for (const [index, object] of value.objects.entries()) {
    const parsed = parseObjectScopeObject(object, index, value.project_id, value.run_id);
    if (!parsed.ok) return parsed;
    objects.push(parsed.value);
  }

  return {
    ok: true,
    value: {
      client_id: value.client_id,
      project_id: value.project_id,
      run_id: value.run_id,
      objects,
    },
  };
}

function parseObjectScopeObject(
  value: unknown,
  index: number,
  projectId: string,
  runId: string,
): ParseResult<ObjectUploadScopeObject> {
  if (!isRecord(value)) return { ok: false, error: `body.objects[${index}] must be an object` };
  const storageRef = value.storage_ref;
  if (typeof storageRef !== 'string' || !storageRef.startsWith('od://objects/')) {
    return { ok: false, error: `body.objects[${index}].storage_ref must be an od://objects reference` };
  }
  const objectClass = value.object_class;
  if (!isAllowedObjectClass(objectClass)) {
    return { ok: false, error: `body.objects[${index}].object_class must be an allowed object class` };
  }
  const expectedPrefix = expectedStorageRefPrefix(projectId, runId, objectClass);
  if (!expectedPrefix || !storageRef.startsWith(expectedPrefix)) {
    return { ok: false, error: `body.objects[${index}].storage_ref must match the project, run, and object class` };
  }
  const sizeBytes = value.size_bytes;
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return { ok: false, error: `body.objects[${index}].size_bytes must be a non-negative number` };
  }
  const sha256 = value.sha256;
  if (typeof sha256 !== 'string' || !/^sha256:[a-f0-9]{64}$/i.test(sha256)) {
    return { ok: false, error: `body.objects[${index}].sha256 must be a sha256 hex digest` };
  }
  return {
    ok: true,
    value: {
      storage_ref: storageRef,
      object_class: objectClass,
      size_bytes: Math.floor(sizeBytes),
      sha256: sha256.toLowerCase(),
    },
  };
}

export function parseObjectBatchBody(value: unknown): ParseResult<ObjectBatchBody> {
  if (!isRecord(value)) return { ok: false, error: 'body must be a JSON object' };
  if (typeof value.client_id !== 'string' || value.client_id.length === 0) {
    return { ok: false, error: 'body.client_id must be a string' };
  }
  if (typeof value.project_id !== 'string' || value.project_id.length === 0) {
    return { ok: false, error: 'body.project_id must be a string' };
  }
  if (typeof value.run_id !== 'string' || value.run_id.length === 0) {
    return { ok: false, error: 'body.run_id must be a string' };
  }
  if (typeof value.upload_token !== 'string' || value.upload_token.length === 0) {
    return { ok: false, error: 'body.upload_token must be a string' };
  }
  if (!Array.isArray(value.objects)) return { ok: false, error: 'body.objects must be an array' };
  if (value.objects.length === 0) return { ok: false, error: 'body.objects must not be empty' };
  if (value.objects.length > 100) return { ok: false, error: 'body.objects has too many objects' };

  const objects: ObjectBatchObject[] = [];
  for (const [index, object] of value.objects.entries()) {
    const parsed = parseObjectBatchObject(object, index, value.project_id, value.run_id);
    if (!parsed.ok) return parsed;
    objects.push(parsed.value);
  }

  return {
    ok: true,
    value: {
      client_id: value.client_id,
      project_id: value.project_id,
      run_id: value.run_id,
      upload_token: value.upload_token,
      objects,
    },
  };
}

function parseObjectBatchObject(
  value: unknown,
  index: number,
  projectId: string,
  runId: string,
): ParseResult<ObjectBatchObject> {
  if (!isRecord(value)) return { ok: false, error: `body.objects[${index}] must be an object` };
  const storageRef = value.storage_ref;
  if (typeof storageRef !== 'string' || !storageRef.startsWith('od://objects/')) {
    return { ok: false, error: `body.objects[${index}].storage_ref must be an od://objects reference` };
  }
  const objectClass = value.object_class;
  if (!isAllowedObjectClass(objectClass)) {
    return { ok: false, error: `body.objects[${index}].object_class must be an allowed object class` };
  }
  const expectedPrefix = expectedStorageRefPrefix(projectId, runId, objectClass);
  if (!expectedPrefix || !storageRef.startsWith(expectedPrefix)) {
    return { ok: false, error: `body.objects[${index}].storage_ref must match the project, run, and object class` };
  }
  const contentBase64 = value.content_base64;
  if (typeof contentBase64 !== 'string' || contentBase64.length === 0) {
    return { ok: false, error: `body.objects[${index}].content_base64 must be a string` };
  }
  if (value.mime !== undefined && typeof value.mime !== 'string') {
    return { ok: false, error: `body.objects[${index}].mime must be a string` };
  }
  if (value.mime === undefined) {
    return {
      ok: true,
      value: { storage_ref: storageRef, object_class: objectClass, content_base64: contentBase64 },
    };
  }
  return {
    ok: true,
    value: {
      storage_ref: storageRef,
      object_class: objectClass,
      content_base64: contentBase64,
      mime: value.mime,
    },
  };
}
