export const DEFAULT_OBJECT_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_OBJECT_BATCH_MAX_BYTES = 20 * 1024 * 1024;
export const INPUT_MAX_BYTES = 8 * 1024;

export type ObjectClass = 'attachment' | 'artifact' | 'input_text_snapshot';
export type ObjectManifestCompleteness = 'complete' | 'partial' | 'unavailable';
export type ObjectManifestStatus = 'ok' | 'partial' | 'unavailable';
export type ObjectManifestSensitivity = 'public' | 'internal' | 'private' | 'sensitive';
export type ObjectManifestAccessScope = 'owner' | 'project' | 'workspace' | 'evaluator';
export type ObjectManifestRetentionPolicy =
  | 'ephemeral'
  | 'observability_90d'
  | 'project_lifetime'
  | 'eval_fixture'
  | 'legal_hold';

export interface TraceSafeObjectManifestBase {
  object_class: ObjectClass;
  storage_ref: string;
  status: ObjectManifestStatus;
  reason?: string;
  project_id: string | null;
  run_id: string;
  workspace_id: string | null;
  size_bytes?: number;
  sha256?: string;
  mime_type: string;
  extension?: string;
  redacted: boolean;
  truncated: boolean;
  stored_in_open_design: boolean;
  retention_policy: ObjectManifestRetentionPolicy;
  access_scope: ObjectManifestAccessScope;
  sensitivity: ObjectManifestSensitivity;
  source: 'user_upload' | 'agent_generated' | 'user_prompt';
  expires_at: string | null;
  approved_by: string | null;
  open_in_open_design_url?: null;
  preview_status?: string;
  access_policy?: 'open_design_auth_required';
}

export interface AttachmentManifestEntry extends TraceSafeObjectManifestBase {
  object_class: 'attachment';
  attachment_id: string;
}

export interface ArtifactManifestEntry extends TraceSafeObjectManifestBase {
  object_class: 'artifact';
  artifact_id: string;
  type: string;
  artifact_kind?: string;
  build_status?: string;
  export_status?: string;
}

export interface InputTextSnapshotManifestEntry extends TraceSafeObjectManifestBase {
  object_class: 'input_text_snapshot';
  input_text_snapshot_id: string;
  type: 'text';
}

export type TraceObjectManifestEntry =
  | AttachmentManifestEntry
  | ArtifactManifestEntry
  | InputTextSnapshotManifestEntry;

export interface TraceObjectUploadManifests {
  attachmentManifest?: AttachmentManifestEntry[];
  artifactManifest?: ArtifactManifestEntry[];
  inputTextSnapshotManifest?: InputTextSnapshotManifestEntry[];
  completeness: ObjectManifestCompleteness;
}

export interface ArtifactSummary {
  slug: string;
  type: string;
  sizeBytes: number;
  sha256?: string;
  createdAt?: string;
}

export interface TraceArtifactObjectSource {
  summary: ArtifactSummary;
  sourcePath?: string;
}

export interface BuildTraceObjectManifestsOptions {
  installationId: string | null;
  projectId: string;
  runId: string;
  projectsRoot: string;
  projectMetadata?: Record<string, unknown> | null;
  attachmentPaths?: string[];
  artifacts?: TraceArtifactObjectSource[];
  prompt: string;
  prefs: {
    metrics?: boolean;
    content?: boolean;
    artifactManifest?: boolean;
  };
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  uploadMode?: 'manifest-only' | 'upload';
}

export interface TraceObjectSource {
  objectClass: ObjectClass;
  id: string;
  filename: string;
  mime: string;
  type?: string;
  body?: Buffer;
  sizeBytes?: number;
  reason?: string;
  source: string;
  truncated?: boolean;
}

export interface ObjectRelayConfig {
  url: string;
  authorizeUrl: string;
  timeoutMs: number;
  objectMaxBytes: number;
  objectBatchMaxBytes: number;
}

export interface RelayResult {
  storage_ref: string;
  status: 'available' | 'unavailable';
  reason?: string;
  size_bytes?: number;
  sha256?: string;
}

export interface ObjectRelayRequestObject {
  storage_ref: string;
  object_class: ObjectClass;
  filename: string;
  mime: string;
  size_bytes: number;
  sha256: string;
  content_base64: string;
}

export interface ObjectRelayAuthorizeObject {
  storage_ref: string;
  object_class: ObjectClass;
  size_bytes: number;
  sha256: string;
}
