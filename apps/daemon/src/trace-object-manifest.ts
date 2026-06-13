import { postObjectBatch, readObjectRelayConfig } from './trace-object-relay-client.js';
import {
  collectTraceObjectSources,
  sha256,
} from './trace-object-manifest-sources.js';
import {
  type ArtifactManifestEntry,
  type AttachmentManifestEntry,
  type BuildTraceObjectManifestsOptions,
  type InputTextSnapshotManifestEntry,
  type ObjectClass,
  type ObjectRelayRequestObject,
  type TraceObjectManifestEntry,
  type TraceObjectSource,
  type TraceObjectUploadManifests,
} from './trace-object-manifest-types.js';

export type {
  ArtifactManifestEntry,
  AttachmentManifestEntry,
  BuildTraceObjectManifestsOptions,
  InputTextSnapshotManifestEntry,
  ObjectManifestCompleteness,
  TraceArtifactObjectSource,
  TraceObjectUploadManifests,
} from './trace-object-manifest-types.js';

const DEFAULT_RETENTION_DAYS = 90;

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/[^A-Za-z0-9._=-]/g, '_'))
    .filter((segment) => segment !== '.' && segment !== '..')
    .join('/');
}

function storageRef(projectId: string, runId: string, objectClass: ObjectClass, id: string): string {
  const safeProject = sanitizeSegment(projectId || 'unknown-project') || 'unknown-project';
  const safeRun = sanitizeSegment(runId || 'unknown-run') || 'unknown-run';
  const safeId = sanitizeSegment(id);
  return `od://objects/workspaces/unknown/projects/${safeProject}/runs/${safeRun}/${objectClass}/${safeId}`;
}

function extensionFromName(value: string): string | undefined {
  const basename = value.split(/[\\/]/).pop() ?? '';
  const dot = basename.lastIndexOf('.');
  if (dot <= 0 || dot === basename.length - 1) return undefined;
  return basename.slice(dot + 1).toLowerCase();
}

function manifestBase(
  source: TraceObjectSource,
  opts: BuildTraceObjectManifestsOptions,
  now: Date,
): TraceObjectManifestEntry {
  const extension = extensionFromName(source.filename);
  const common = {
    storage_ref: storageRef(opts.projectId, opts.runId, source.objectClass, source.id),
    status: 'unavailable' as const,
    project_id: opts.projectId || null,
    run_id: opts.runId,
    workspace_id: null,
    ...(source.sizeBytes !== undefined ? { size_bytes: source.sizeBytes } : {}),
    mime_type: source.mime,
    ...(extension ? { extension } : {}),
    redacted: false,
    truncated: source.truncated === true,
    stored_in_open_design: false,
    retention_policy: 'observability_90d' as const,
    access_scope: 'project' as const,
    sensitivity: 'private' as const,
    expires_at: new Date(now.getTime() + DEFAULT_RETENTION_DAYS * 86_400_000).toISOString(),
    approved_by: null,
    open_in_open_design_url: null,
    preview_status: 'not_available',
    access_policy: 'open_design_auth_required' as const,
    ...(source.reason ? { reason: source.reason } : {}),
  };

  if (source.objectClass === 'attachment') {
    return {
      ...common,
      object_class: 'attachment',
      attachment_id: source.id,
      source: 'user_upload',
    };
  }
  if (source.objectClass === 'artifact') {
    return {
      ...common,
      object_class: 'artifact',
      artifact_id: source.id,
      type: source.type ?? 'unknown',
      build_status: 'complete',
      export_status: 'unavailable',
      source: 'agent_generated',
    };
  }
  return {
    ...common,
    object_class: 'input_text_snapshot',
    input_text_snapshot_id: source.id,
    type: 'text',
    source: 'user_prompt',
  };
}

function withSourceDigest(
  entry: TraceObjectManifestEntry,
  source: TraceObjectSource,
): TraceObjectManifestEntry {
  if (!source.body) return entry;
  return {
    ...entry,
    size_bytes: source.body.byteLength,
    sha256: sha256(source.body),
  };
}

function relayObjects(
  manifests: TraceObjectManifestEntry[],
  sources: TraceObjectSource[],
  objectMaxBytes: number,
): ObjectRelayRequestObject[] {
  return sources
    .map((source, index) => ({ source, manifest: manifests[index] }))
    .filter((item): item is { source: TraceObjectSource; manifest: TraceObjectManifestEntry } =>
      item.manifest !== undefined && item.source.body !== undefined
    )
    .filter((item) => item.source.body!.byteLength <= objectMaxBytes)
    .map(({ source, manifest }) => ({
      storage_ref: manifest.storage_ref,
      object_class: source.objectClass,
      filename: source.filename,
      mime: source.mime,
      size_bytes: source.body!.byteLength,
      sha256: sha256(source.body!),
      content_base64: source.body!.toString('base64'),
    }));
}

function groupManifests(entries: TraceObjectManifestEntry[]): TraceObjectUploadManifests {
  const attachmentManifest = entries.filter(
    (entry): entry is AttachmentManifestEntry => entry.object_class === 'attachment',
  );
  const artifactManifest = entries.filter(
    (entry): entry is ArtifactManifestEntry => entry.object_class === 'artifact',
  );
  const inputTextSnapshotManifest = entries.filter(
    (entry): entry is InputTextSnapshotManifestEntry =>
      entry.object_class === 'input_text_snapshot',
  );
  return {
    ...(attachmentManifest.length > 0 ? { attachmentManifest } : {}),
    ...(artifactManifest.length > 0 ? { artifactManifest } : {}),
    ...(inputTextSnapshotManifest.length > 0 ? { inputTextSnapshotManifest } : {}),
    completeness: entries.length > 0 && entries.every((entry) => entry.status === 'ok')
      ? 'complete'
      : entries.length > 0
        ? 'partial'
        : 'unavailable',
  };
}

export async function buildTraceObjectManifests(
  opts: BuildTraceObjectManifestsOptions,
): Promise<TraceObjectUploadManifests | undefined> {
  if (opts.prefs.metrics !== true || opts.prefs.content !== true) return undefined;
  const config = readObjectRelayConfig(opts.env ?? process.env);
  if (!config) return undefined;

  const now = opts.now ? opts.now() : new Date();
  const sources = await collectTraceObjectSources(opts, config);
  if (sources.length === 0) return undefined;
  const manifests = sources.map((source) => manifestBase(source, opts, now));

  if (opts.uploadMode === 'manifest-only') {
    return groupManifests(manifests.map((entry, index) => ({
      ...withSourceDigest(entry, sources[index]!),
      status: 'unavailable',
      stored_in_open_design: false,
    })));
  }

  const results = await postObjectBatch(config, opts, relayObjects(
    manifests,
    sources,
    config.objectMaxBytes,
  ));
  const resultByRef = new Map(results.map((result) => [result.storage_ref, result]));
  return groupManifests(manifests.map((entry, index) => {
    const source = sources[index]!;
    const result = resultByRef.get(entry.storage_ref);
    if (!result) {
      return {
        ...entry,
        reason: entry.reason ?? (source.body ? 'relay_missing_result' : 'source_unavailable'),
      };
    }
    return {
      ...entry,
      status: result.status === 'available' ? 'ok' : 'unavailable',
      stored_in_open_design: result.status === 'available',
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.size_bytes !== undefined ? { size_bytes: result.size_bytes } : {}),
      ...(result.sha256 ? { sha256: result.sha256 } : {}),
    };
  }));
}
