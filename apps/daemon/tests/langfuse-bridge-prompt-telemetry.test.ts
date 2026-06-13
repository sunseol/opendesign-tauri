import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reportRunCompletedFromDaemon } from '../src/langfuse-bridge.js';
import {
  PROMPT_STACK_PATH_MARKER,
  buildPromptStackTelemetry,
} from '../src/prompt-telemetry.js';

type BridgeRun = Parameters<typeof reportRunCompletedFromDaemon>[0]['run'];
type PromptTelemetry = NonNullable<BridgeRun['promptTelemetry']>;

type CapturedFetch = {
  readonly fetchImpl: typeof fetch;
  readonly requests: RequestInit[];
};

type IngestionEvent = {
  readonly type: string;
  readonly body: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function makeCapturedFetch(): CapturedFetch {
  const requests: RequestInit[] = [];
  return {
    requests,
    fetchImpl: async (_input, init) => {
      requests.push(init ?? {});
      return new Response('{}', { status: 207 });
    },
  };
}

function requestBatch(requests: readonly RequestInit[]): readonly unknown[] {
  const first = requests[0];
  if (!first || typeof first.body !== 'string') {
    throw new Error('missing Langfuse request body');
  }
  const parsed: unknown = JSON.parse(first.body);
  if (!isRecord(parsed) || !Array.isArray(parsed.batch)) {
    throw new Error('missing Langfuse batch');
  }
  return parsed.batch;
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

function arrayField(
  value: Record<string, unknown>,
  field: string,
): readonly unknown[] {
  const next = value[field];
  if (!Array.isArray(next)) throw new Error(`missing array ${field}`);
  return next;
}

function sectionByKind(
  input: Record<string, unknown>,
  kind: string,
): Record<string, unknown> {
  const section = arrayField(input, 'sections').find(
    (item): item is Record<string, unknown> => isRecord(item) && item.kind === kind,
  );
  if (!section) throw new Error(`missing prompt section ${kind}`);
  return section;
}

function makeRun(promptTelemetry: PromptTelemetry): BridgeRun {
  const now = 1_800_000_000_000;
  return {
    id: 'run-id-1',
    projectId: 'proj-1',
    conversationId: 'conv-1',
    assistantMessageId: null,
    agentId: 'codex',
    status: 'succeeded',
    createdAt: now,
    updatedAt: now + 1000,
    events: [],
    userPrompt: 'Build a settings panel',
    promptTelemetry,
  } satisfies BridgeRun;
}

describe('langfuse bridge prompt telemetry', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'od-bridge-prompt-'));
    await writeFile(
      path.join(dataDir, 'app-config.json'),
      JSON.stringify({
        installationId: 'install-1',
        telemetry: { metrics: true, content: true },
      }),
    );
    process.env.LANGFUSE_PUBLIC_KEY = 'pk';
    process.env.LANGFUSE_SECRET_KEY = 'sk';
  });

  afterEach(async () => {
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    await rm(dataDir, { recursive: true, force: true });
  });

  it('forwards run prompt telemetry as structured generation input', async () => {
    const promptTelemetry = buildPromptStackTelemetry({
      composedPrompt:
        '# Instructions\nRead /Users/alice/project before answering.\n\n# User request\nBuild a settings panel',
      sections: [
        {
          kind: 'daemonSystemPrompt',
          content:
            'Read /Users/alice/project before answering with sk-test-1234567890123456789012.',
        },
        { kind: 'userRequest', content: 'Build a settings panel' },
      ],
    });
    const captured = makeCapturedFetch();

    await reportRunCompletedFromDaemon({
      db: { prepare: () => { throw new Error('unexpected DB read'); } },
      dataDir,
      run: makeRun(promptTelemetry),
      fetchImpl: captured.fetchImpl,
    });

    const batch = requestBatch(captured.requests);
    const trace = eventBody(batch, 'trace-create');
    const generation = eventBody(batch, 'generation-create', 'llm');
    const generationInput = recordField(generation, 'input');
    const traceMetadata = recordField(trace, 'metadata');
    const generationMetadata = recordField(generation, 'metadata');
    const systemSection = sectionByKind(generationInput, 'daemonSystemPrompt');
    const userSection = sectionByKind(generationInput, 'userRequest');

    expect(trace.input).toBe('Build a settings panel');
    expect(generationInput.type).toBe('open-design.prompt-stack');
    expect(systemSection.redactedContent).toContain(PROMPT_STACK_PATH_MARKER);
    expect(systemSection.redactedContent).not.toContain('/Users/alice');
    expect(systemSection.redactedContent).not.toContain('sk-test-');
    expect(userSection.redactedContent).toBe('Build a settings panel');
    expect(traceMetadata.promptStack).toBeUndefined();
    expect(generationMetadata.promptStack).toBeUndefined();
    expect(traceMetadata.promptStack_sectionCount).toBe(2);
    expect(generationMetadata.promptStack_sectionCount).toBe(2);
    expect(traceMetadata.promptStack_promptFingerprint).toBe(
      generationMetadata.promptStack_promptFingerprint,
    );
  });
});
