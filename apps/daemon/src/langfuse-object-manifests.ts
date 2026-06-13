import path from 'node:path';

import type { TelemetryPrefs } from './app-config.js';
import type { ArtifactSummary, TelemetrySinkConfig } from './langfuse-trace.js';
import {
  buildTraceObjectManifests,
  type TraceArtifactObjectSource,
  type TraceObjectUploadManifests,
} from './trace-object-manifest.js';

const DEFAULT_FETCH_TIMEOUT_MS = 20_000;
const DEFAULT_FETCH_RETRIES = 1;

export type DaemonObjectManifestOptions = {
  readonly installationId: string | null;
  readonly dataDir: string;
  readonly projectId: string;
  readonly runId: string;
  readonly prompt: string;
  readonly artifacts: readonly ArtifactSummary[];
  readonly prefs: TelemetryPrefs;
  readonly fetchImpl?: typeof fetch;
  readonly projectMetadata?: Record<string, unknown> | null;
  readonly attachmentPaths?: readonly string[];
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function replaceEndpoint(
  rawUrl: string,
  from: RegExp,
  to: string,
): string | null {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (!from.test(url.pathname)) return null;
    url.pathname = url.pathname.replace(from, to);
    return url.toString().replace(/\/+$/, '');
  } catch {
    const derived = trimmed.replace(from, to);
    return derived === trimmed ? null : derived.replace(/\/+$/, '');
  }
}

function inferRegistrationRelayUrl(env: NodeJS.ProcessEnv): string | null {
  const telemetryRelay = env.OPEN_DESIGN_TELEMETRY_RELAY_URL?.trim();
  if (telemetryRelay) return telemetryRelay.replace(/\/+$/, '');

  const objectRelay = env.OPEN_DESIGN_OBJECT_RELAY_URL?.trim();
  if (!objectRelay) return null;
  return replaceEndpoint(
    objectRelay,
    /\/api\/objects\/batch\/?$/u,
    '/api/langfuse',
  );
}

export function objectRegistrationTelemetryConfig(
  env: NodeJS.ProcessEnv = process.env,
): TelemetrySinkConfig | null {
  const relayUrl = inferRegistrationRelayUrl(env);
  if (!relayUrl) return null;
  return {
    kind: 'relay',
    relayUrl,
    timeoutMs: parsePositiveInt(
      env.OPEN_DESIGN_TELEMETRY_TIMEOUT_MS ?? env.LANGFUSE_TIMEOUT_MS,
      DEFAULT_FETCH_TIMEOUT_MS,
    ),
    retries: parseNonNegativeInt(
      env.OPEN_DESIGN_TELEMETRY_RETRIES ?? env.LANGFUSE_RETRIES,
      DEFAULT_FETCH_RETRIES,
    ),
  };
}

function artifactObjectSources(
  artifacts: readonly ArtifactSummary[],
): TraceArtifactObjectSource[] {
  return artifacts.map((summary) => ({
    summary,
    sourcePath: summary.slug,
  }));
}

function buildTraceObjectOptions(opts: DaemonObjectManifestOptions) {
  return {
    installationId: opts.installationId,
    projectId: opts.projectId,
    runId: opts.runId,
    projectsRoot: path.join(opts.dataDir, 'projects'),
    artifacts: artifactObjectSources(opts.artifacts),
    prompt: opts.prompt,
    prefs: opts.prefs,
    ...(opts.projectMetadata !== undefined
      ? { projectMetadata: opts.projectMetadata }
      : {}),
    ...(opts.attachmentPaths ? { attachmentPaths: [...opts.attachmentPaths] } : {}),
    ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
  };
}

export async function buildDaemonRegistrationManifests(
  opts: DaemonObjectManifestOptions,
): Promise<TraceObjectUploadManifests | undefined> {
  return buildTraceObjectManifests({
    ...buildTraceObjectOptions(opts),
    uploadMode: 'manifest-only',
  });
}

export async function buildDaemonUploadedManifests(
  opts: DaemonObjectManifestOptions,
): Promise<TraceObjectUploadManifests | undefined> {
  return buildTraceObjectManifests(buildTraceObjectOptions(opts));
}
