import path from 'node:path';

import { redactSecrets } from './redact.js';
import {
  PROMPT_STACK_KIB,
  PROMPT_STACK_PATH_MARKER,
  type PromptTelemetryInputSection,
  type PromptTelemetrySectionKind,
} from './prompt-telemetry-types.js';

const FILE_LOCAL_PATH =
  /(^|[\s([{"'`@])file:\/\/(?:localhost)?\/[^\s)\]}"'`,;<>]+/gi;
const POSIX_LOCAL_PATH =
  /(^|[\s([{"'`@])\/(?:Users|home|root|tmp|private\/tmp|private\/var\/folders|private\/var\/tmp|var\/folders|var\/tmp|usr\/local|opt|Volumes|mnt|media|srv|workspace|workspaces|app)\/[^\s)\]}"'`,;<>]+/g;
const WINDOWS_LOCAL_PATH =
  /(^|[\s([{"'`@])(?:[A-Za-z]:\\|\\\\)[^\s)\]}"'`,;<>]+/g;

export function redactLocalPaths(input: string): string {
  if (!input) return input;
  return input
    .replace(FILE_LOCAL_PATH, (_match, prefix: string) =>
      `${prefix}${PROMPT_STACK_PATH_MARKER}`,
    )
    .replace(POSIX_LOCAL_PATH, (_match, prefix: string) =>
      `${prefix}${PROMPT_STACK_PATH_MARKER}`,
    )
    .replace(WINDOWS_LOCAL_PATH, (_match, prefix: string) =>
      `${prefix}${PROMPT_STACK_PATH_MARKER}`,
    );
}

function stripRuntimeToolPromptTokens(input: string): string {
  return input
    .split(/\r?\n/u)
    .filter((line) => !line.includes('OD_TOOL_TOKEN'))
    .join('\n');
}

export function redactPromptText(input: string): string {
  return redactLocalPaths(redactSecrets(input));
}

export function sanitizeSectionContent(
  kind: PromptTelemetrySectionKind,
  content: string,
): string {
  const structurallySafe =
    kind === 'runtimeToolPrompt' ? stripRuntimeToolPromptTokens(content) : content;
  return redactPromptText(structurallySafe);
}

function extensionFromPath(value: string): string | null {
  const ext = path.extname(value).replace(/^\./u, '').toLowerCase();
  return ext || null;
}

function sizeBucket(value: number): string {
  if (value <= 0) return 'unknown';
  if (value <= 10 * PROMPT_STACK_KIB) return '0-10KiB';
  if (value <= 100 * PROMPT_STACK_KIB) return '10-100KiB';
  if (value <= 1024 * PROMPT_STACK_KIB) return '100KiB-1MiB';
  return '1MiB+';
}

function collectFileSummary(
  value: readonly unknown[],
): Record<string, unknown> {
  const extensions = new Set<string>();
  const sizeBuckets = new Map<string, number>();
  const selectionKinds = new Map<string, number>();
  let knownSizeCount = 0;
  for (const item of value) {
    if (typeof item === 'string') {
      const ext = extensionFromPath(item);
      if (ext) extensions.add(ext);
      continue;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const obj = item as Record<string, unknown>;
    const fileLike =
      typeof obj.filePath === 'string'
        ? obj.filePath
        : typeof obj.screenshotPath === 'string'
          ? obj.screenshotPath
          : typeof obj.path === 'string'
            ? obj.path
            : typeof obj.name === 'string'
              ? obj.name
              : '';
    const ext = fileLike ? extensionFromPath(fileLike) : null;
    if (ext) extensions.add(ext);
    const size = typeof obj.size === 'number' ? obj.size : undefined;
    if (size !== undefined && Number.isFinite(size)) {
      knownSizeCount += 1;
      const bucket = sizeBucket(size);
      sizeBuckets.set(bucket, (sizeBuckets.get(bucket) ?? 0) + 1);
    }
    if (typeof obj.selectionKind === 'string') {
      selectionKinds.set(
        obj.selectionKind,
        (selectionKinds.get(obj.selectionKind) ?? 0) + 1,
      );
    }
  }
  return {
    count: value.length,
    extensions: Array.from(extensions).sort(),
    sizeBuckets: Object.fromEntries([...sizeBuckets].sort()),
    knownSizeCount,
    selectionKinds: Object.fromEntries([...selectionKinds].sort()),
  };
}

export function summarizeMetadataValue(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return collectFileSummary(value);
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return { keyCount: keys.length, keys };
  }
  if (typeof value === 'string') {
    const ext = extensionFromPath(value);
    return {
      count: value.length > 0 ? 1 : 0,
      extensions: ext ? [ext] : [],
    };
  }
  return {};
}

export function metadataFingerprintSource(
  section: PromptTelemetryInputSection,
): Record<string, unknown> {
  if (section.metadata !== undefined) {
    return summarizeMetadataValue(section.metadata);
  }
  return summarizeMetadataValue(section.content ?? '');
}
