import { createHash } from 'node:crypto';

import {
  metadataFingerprintSource,
  redactLocalPaths,
  redactPromptText,
  sanitizeSectionContent,
  summarizeMetadataValue,
} from './prompt-telemetry-redaction.js';
import {
  PROMPT_STACK_DAEMON_SYSTEM_PROMPT_MAX_BYTES,
  PROMPT_STACK_REDACTION_VERSION,
  PROMPT_STACK_SECTION_MAX_BYTES,
  PROMPT_STACK_TOTAL_CONTENT_MAX_BYTES,
  type PromptStackTelemetry,
  type PromptTelemetryInputSection,
  type PromptTelemetrySection,
  type PromptTelemetrySectionKind,
  type StructuredPromptStackInput,
} from './prompt-telemetry-types.js';

export {
  PROMPT_STACK_PATH_MARKER,
  PROMPT_STACK_REDACTION_VERSION,
  type PromptStackTelemetry,
  type PromptTelemetryInputSection,
  type PromptTelemetrySection,
  type PromptTelemetrySectionKind,
  type StructuredPromptStackInput,
} from './prompt-telemetry-types.js';
export { redactLocalPaths } from './prompt-telemetry-redaction.js';

type MutablePromptTelemetrySection = PromptTelemetrySection & {
  redactedSource: string;
  truncated: boolean;
  truncationReason?: PromptTelemetrySection['truncationReason'];
  redactedContent?: string;
};

const REDACTED_CONTENT_KINDS: ReadonlySet<PromptTelemetrySectionKind> = new Set([
  'formOverride',
  'daemonSystemPrompt',
  'runtimeToolPrompt',
  'researchCommandContract',
  'runContextPrompt',
  'clientSystemPrompt',
  'echoGuard',
  'userRequest',
  'skillPrompt',
  'designSystemPrompt',
  'pluginStagePrompt',
]);

const SECTION_PRIORITY: ReadonlyMap<PromptTelemetrySectionKind, number> = new Map([
  ['formOverride', 1],
  ['daemonSystemPrompt', 2],
  ['runtimeToolPrompt', 3],
  ['clientSystemPrompt', 4],
  ['skillPrompt', 5],
  ['designSystemPrompt', 5],
  ['pluginStagePrompt', 5],
  ['researchCommandContract', 6],
  ['runContextPrompt', 7],
  ['echoGuard', 8],
  ['userRequest', 9],
]);

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function truncateUtf8(value: string, maxBytes: number): string {
  const buf = Buffer.from(value, 'utf8');
  if (buf.length <= maxBytes) return value;
  let cut = maxBytes;
  while (cut > 0 && ((buf[cut] ?? 0) & 0xc0) === 0x80) {
    cut -= 1;
  }
  return buf.subarray(0, cut).toString('utf8');
}

function perSectionLimit(kind: PromptTelemetrySectionKind): number {
  return kind === 'daemonSystemPrompt'
    ? PROMPT_STACK_DAEMON_SYSTEM_PROMPT_MAX_BYTES
    : PROMPT_STACK_SECTION_MAX_BYTES;
}

function buildSection(
  section: PromptTelemetryInputSection,
  index: number,
): MutablePromptTelemetrySection {
  const rawContent = typeof section.content === 'string' ? section.content : '';
  const present =
    rawContent.length > 0 ||
    (Array.isArray(section.metadata)
      ? section.metadata.length > 0
      : section.metadata !== undefined && section.metadata !== null);
  const isContentKind = REDACTED_CONTENT_KINDS.has(section.kind);
  const canCaptureContent = isContentKind && section.captureContent !== false;
  const redacted = isContentKind
    ? sanitizeSectionContent(section.kind, rawContent)
    : JSON.stringify(metadataFingerprintSource(section));
  const metadata = isContentKind
    ? section.metadata && typeof section.metadata === 'object'
      ? summarizeMetadataValue(section.metadata)
      : undefined
    : metadataFingerprintSource(section);
  return {
    kind: section.kind,
    ordinal: index,
    present,
    contentMode: canCaptureContent
      ? 'redacted-section-content'
      : 'metadata-only',
    rawBytes: byteLength(rawContent),
    redactedBytes: byteLength(redacted),
    fingerprint: sha256(redacted),
    truncated: false,
    redactedSource: redacted,
    ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

function allocateContent(sections: MutablePromptTelemetrySection[]): void {
  let remaining = PROMPT_STACK_TOTAL_CONTENT_MAX_BYTES;
  const allocationOrder = [...sections]
    .filter((section) => section.present && section.contentMode === 'redacted-section-content')
    .sort((a, b) => {
      const priorityA = SECTION_PRIORITY.get(a.kind) ?? 99;
      const priorityB = SECTION_PRIORITY.get(b.kind) ?? 99;
      return priorityA - priorityB || a.ordinal - b.ordinal;
    });
  for (const section of allocationOrder) {
    if (remaining <= 0) {
      section.truncated = true;
      section.truncationReason = 'total_budget_exceeded';
      continue;
    }
    const limit = Math.min(perSectionLimit(section.kind), remaining);
    const redactedContent = truncateUtf8(section.redactedSource, limit);
    const contentBytes = byteLength(redactedContent);
    if (contentBytes > 0) section.redactedContent = redactedContent;
    remaining -= contentBytes;
    if (contentBytes < byteLength(section.redactedSource)) {
      section.truncated = true;
      section.truncationReason =
        limit < perSectionLimit(section.kind)
          ? 'total_budget_exceeded'
          : 'section_byte_limit';
    }
  }
}

export function buildPromptStackTelemetry(input: {
  readonly composedPrompt: string;
  readonly sections: readonly PromptTelemetryInputSection[];
}): PromptStackTelemetry {
  const normalizedComposed = redactPromptText(input.composedPrompt);
  const built = input.sections.map((section, index) => buildSection(section, index));
  allocateContent(built);
  const outputSections = built
    .filter((section) => section.present)
    .map(({ redactedSource: _redactedSource, ...section }) => section);
  const stackFingerprintSource = outputSections.map((section) => ({
    kind: section.kind,
    ordinal: section.ordinal,
    fingerprint: section.fingerprint,
  }));
  const redactedContentBytes = outputSections.reduce(
    (total, section) => total + byteLength(section.redactedContent ?? ''),
    0,
  );
  return {
    redactionVersion: PROMPT_STACK_REDACTION_VERSION,
    promptFingerprint: sha256(normalizedComposed),
    stackFingerprint: sha256(JSON.stringify(stackFingerprintSource)),
    rawBytes: byteLength(input.composedPrompt),
    redactedBytes: byteLength(normalizedComposed),
    sectionCount: outputSections.length,
    redactedContentBytes,
    redactedContentBudgetBytes: PROMPT_STACK_TOTAL_CONTENT_MAX_BYTES,
    sections: outputSections,
  };
}

export function promptStackWithoutContent(
  telemetry: PromptStackTelemetry,
): PromptStackTelemetry {
  return {
    ...telemetry,
    redactedContentBytes: 0,
    sections: telemetry.sections.map(({ redactedContent: _content, ...section }) => section),
  };
}

export function structuredPromptStackInput(
  telemetry: PromptStackTelemetry,
): StructuredPromptStackInput {
  return {
    type: 'open-design.prompt-stack',
    redactionVersion: telemetry.redactionVersion,
    promptFingerprint: telemetry.promptFingerprint,
    stackFingerprint: telemetry.stackFingerprint,
    sectionCount: telemetry.sectionCount,
    redactedContentBytes: telemetry.redactedContentBytes,
    redactedContentBudgetBytes: telemetry.redactedContentBudgetBytes,
    sections: telemetry.sections.map((section) => ({
      kind: section.kind,
      ordinal: section.ordinal,
      contentMode: section.contentMode,
      rawBytes: section.rawBytes,
      redactedBytes: section.redactedBytes,
      fingerprint: section.fingerprint,
      truncated: section.truncated,
      ...(section.truncationReason
        ? { truncationReason: section.truncationReason }
        : {}),
      ...(section.redactedContent !== undefined
        ? { redactedContent: section.redactedContent }
        : {}),
      ...(section.metadata ? { metadata: section.metadata } : {}),
    })),
  };
}

export function buildPromptStackFlatMetadata(
  telemetry: PromptStackTelemetry,
): Record<string, unknown> {
  return {
    promptStack_redactionVersion: telemetry.redactionVersion,
    promptStack_promptFingerprint: telemetry.promptFingerprint,
    promptStack_stackFingerprint: telemetry.stackFingerprint,
    promptStack_sectionCount: telemetry.sectionCount,
    promptStack_redactedContentBytes: telemetry.redactedContentBytes,
    promptStack_redactedContentBudgetBytes:
      telemetry.redactedContentBudgetBytes,
  };
}
