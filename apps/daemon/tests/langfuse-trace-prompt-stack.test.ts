import { describe, expect, it } from 'vitest';

import { buildTracePayload, type ReportContext } from '../src/langfuse-trace.js';

type IngestionEvent = {
  readonly type: string;
  readonly body: Record<string, unknown>;
};

type PromptStackTelemetry = NonNullable<ReportContext['promptTelemetry']>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function eventBody(
  batch: readonly unknown[],
  type: string,
  name?: string,
): Record<string, unknown> {
  const event = batch.find((item): item is IngestionEvent => {
    if (!isRecord(item) || item.type !== type || !isRecord(item.body)) {
      return false;
    }
    return name === undefined || item.body.name === name;
  });
  if (!event) throw new Error(`missing ${type} ${name ?? ''}`);
  return event.body;
}

function recordField(
  value: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  const next = value[field];
  if (!isRecord(next)) throw new Error(`missing record ${field}`);
  return next;
}

function firstRecord(value: unknown, label: string): Record<string, unknown> {
  if (!Array.isArray(value) || value.length === 0 || !isRecord(value[0])) {
    throw new Error(`missing ${label}`);
  }
  return value[0];
}

function makePromptTelemetry(): PromptStackTelemetry {
  return {
    redactionVersion: 'prompt-stack-redaction-v1',
    promptFingerprint: 'sha256:prompt',
    stackFingerprint: 'sha256:stack',
    rawBytes: 120,
    redactedBytes: 80,
    sectionCount: 1,
    redactedContentBytes: 24,
    redactedContentBudgetBytes: 512 * 1024,
    sections: [{
      kind: 'userRequest',
      ordinal: 0,
      present: true,
      contentMode: 'redacted-section-content',
      rawBytes: 60,
      redactedBytes: 24,
      fingerprint: 'sha256:section',
      truncated: false,
      redactedContent: 'Build the visible page.',
      metadata: { source: 'test' },
    }],
  };
}

function makeCtx(overrides: Partial<ReportContext> = {}): ReportContext {
  return {
    installationId: 'install-1',
    projectId: 'proj-1',
    conversationId: 'conv-1',
    agentId: 'claude',
    run: {
      runId: 'run-1',
      status: 'succeeded',
      startedAt: 1_800_000_000_000,
      endedAt: 1_800_000_001_000,
    },
    message: {
      messageId: 'msg-1',
      prompt: 'raw prompt',
      output: 'done',
    },
    artifacts: [],
    eventsSummary: { toolCalls: 0, errors: 0, durationMs: 1000 },
    prefs: { metrics: true, content: true, artifactManifest: true },
    ...overrides,
  };
}

describe('langfuse trace prompt stack diagnostics', () => {
  it('uses structured redacted prompt-stack input and flat query metadata', () => {
    const batch = buildTracePayload(
      makeCtx({ promptTelemetry: makePromptTelemetry() }),
    );

    const traceMetadata = recordField(eventBody(batch, 'trace-create'), 'metadata');
    expect(traceMetadata.promptStack_redactionVersion).toBe(
      'prompt-stack-redaction-v1',
    );
    expect(traceMetadata.promptStack_promptFingerprint).toBe('sha256:prompt');
    expect(traceMetadata.promptStack_stackFingerprint).toBe('sha256:stack');
    expect(traceMetadata.promptStack_sectionCount).toBe(1);
    expect(traceMetadata.promptStack_redactedContentBytes).toBe(24);

    const generation = eventBody(batch, 'generation-create', 'llm');
    const generationInput = recordField(generation, 'input');
    expect(generationInput.type).toBe('open-design.prompt-stack');
    expect(generationInput.stackFingerprint).toBe('sha256:stack');
    const section = firstRecord(generationInput.sections, 'prompt section');
    expect(section.kind).toBe('userRequest');
    expect(section.redactedContent).toBe('Build the visible page.');
    expect(section.metadata).toEqual({ source: 'test' });

    const generationMetadata = recordField(generation, 'metadata');
    expect(generationMetadata.promptStack_stackFingerprint).toBe('sha256:stack');
    expect(generationMetadata.promptStack_sectionCount).toBe(1);
  });
});
