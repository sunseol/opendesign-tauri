import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reportRunCompletedFromDaemon } from '../src/langfuse-bridge.js';

type FakeMessage = {
  readonly id: string;
  readonly role: 'assistant';
  readonly content: string;
  readonly producedFiles?: readonly Record<string, unknown>[];
};

type FetchCall = {
  readonly url: string;
  readonly init: RequestInit | undefined;
};

type IngestionEvent = {
  readonly type: string;
  readonly body: Record<string, unknown>;
};

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonBody(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== 'string') {
    throw new Error('expected string request body');
  }
  return JSON.parse(init.body);
}

function recordField(
  value: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  const next = value[field];
  if (!isRecord(next)) throw new Error(`expected record field ${field}`);
  return next;
}

function arrayField(value: Record<string, unknown>, field: string): unknown[] {
  const next = value[field];
  if (!Array.isArray(next)) throw new Error(`expected array field ${field}`);
  return next;
}

function parseBatch(init: RequestInit | undefined): readonly IngestionEvent[] {
  const parsed = parseJsonBody(init);
  if (!isRecord(parsed)) throw new Error('expected batch object');
  return arrayField(parsed, 'batch').map((event) => {
    if (!isRecord(event) || typeof event.type !== 'string') {
      throw new Error('expected ingestion event');
    }
    return {
      type: event.type,
      body: recordField(event, 'body'),
    };
  });
}

function firstTrace(init: RequestInit | undefined): Record<string, unknown> {
  const event = parseBatch(init).find((item) => item.type === 'trace-create');
  if (!event) throw new Error('missing trace-create event');
  return event.body;
}

function firstRecord(value: unknown, label: string): Record<string, unknown> {
  if (!Array.isArray(value) || value.length === 0 || !isRecord(value[0])) {
    throw new Error(`missing ${label}`);
  }
  return value[0];
}

function makeDbWithListMessages(
  messagesByConvo: Record<string, readonly FakeMessage[]>,
): unknown {
  return {
    prepare() {
      return {
        all(cid: string) {
          return (messagesByConvo[cid] ?? []).map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            agentId: null,
            agentName: null,
            runId: null,
            runStatus: null,
            lastRunEventId: null,
            eventsJson: null,
            attachmentsJson: null,
            commentAttachmentsJson: null,
            producedFilesJson: message.producedFiles
              ? JSON.stringify(message.producedFiles)
              : null,
            createdAt: 0,
            startedAt: null,
            endedAt: null,
            position: 0,
          }));
        },
      };
    },
  };
}

function makeRun(): Parameters<typeof reportRunCompletedFromDaemon>[0]['run'] {
  return {
    id: 'run-1',
    projectId: 'proj-1',
    conversationId: 'conv-1',
    assistantMessageId: 'msg-1',
    agentId: 'claude',
    status: 'succeeded',
    createdAt: 1_800_000_000_000,
    updatedAt: 1_800_000_001_000,
    events: [],
    userPrompt: 'build the launch page',
  };
}

describe('langfuse bridge object manifests', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'od-bridge-objects-'));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('registers trace-safe manifests before uploading daemon artifacts', async () => {
    const oldTelemetryRelay = process.env.OPEN_DESIGN_TELEMETRY_RELAY_URL;
    const oldObjectRelay = process.env.OPEN_DESIGN_OBJECT_RELAY_URL;
    const artifactBody = 'release artifact';
    const projectDir = path.join(dataDir, 'projects', 'proj-1');
    await mkdir(projectDir, { recursive: true });
    await writeFile(path.join(projectDir, 'artifact.txt'), artifactBody);
    await writeFile(path.join(dataDir, 'app-config.json'), JSON.stringify({
      installationId: 'install-1',
      telemetry: { metrics: true, content: true, artifactManifest: true },
    }));

    const calls: FetchCall[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });

      if (url.endsWith('/api/langfuse')) {
        return new Response('{}', { status: 207 });
      }

      if (url.endsWith('/api/objects/authorize')) {
        const body = parseJsonBody(init);
        if (!isRecord(body)) throw new Error('expected authorize body');
        const objects = arrayField(body, 'objects');
        expect(objects).toHaveLength(1);
        expect(firstRecord(objects, 'authorize object')).not.toHaveProperty(
          'content_base64',
        );
        return new Response(JSON.stringify({ upload_token: 'upload-token' }));
      }

      if (url.endsWith('/api/objects/batch')) {
        const body = parseJsonBody(init);
        if (!isRecord(body)) throw new Error('expected batch body');
        expect(body.upload_token).toBe('upload-token');
        const object = firstRecord(arrayField(body, 'objects'), 'upload object');
        expect(Buffer.from(String(object.content_base64), 'base64').toString('utf8'))
          .toBe(artifactBody);
        return new Response(JSON.stringify({
          objects: [{
            storage_ref: object.storage_ref,
            status: 'available',
            size_bytes: artifactBody.length,
            sha256: 'sha256:feedface',
          }],
        }));
      }

      throw new Error(`unexpected fetch ${url}`);
    };

    process.env.OPEN_DESIGN_TELEMETRY_RELAY_URL =
      'https://telemetry.open-design.ai/api/langfuse';
    delete process.env.OPEN_DESIGN_OBJECT_RELAY_URL;

    try {
      await reportRunCompletedFromDaemon({
        db: makeDbWithListMessages({
          'conv-1': [{
            id: 'msg-1',
            role: 'assistant',
            content: 'done',
            producedFiles: [{
              name: 'artifact.txt',
              path: 'artifact.txt',
              kind: 'text',
              size: artifactBody.length,
            }],
          }],
        }),
        dataDir,
        run: makeRun(),
        fetchImpl,
      });
    } finally {
      restoreEnv('OPEN_DESIGN_TELEMETRY_RELAY_URL', oldTelemetryRelay);
      restoreEnv('OPEN_DESIGN_OBJECT_RELAY_URL', oldObjectRelay);
    }

    expect(calls.map((call) => call.url)).toEqual([
      'https://telemetry.open-design.ai/api/langfuse',
      'https://telemetry.open-design.ai/api/objects/authorize',
      'https://telemetry.open-design.ai/api/objects/batch',
      'https://telemetry.open-design.ai/api/langfuse',
    ]);

    const registrationMetadata = recordField(firstTrace(calls[0]?.init), 'metadata');
    const registrationArtifact = firstRecord(
      registrationMetadata.artifact_manifest,
      'registration artifact manifest',
    );
    expect(registrationMetadata.manifest_completeness).toBe('partial');
    expect(registrationArtifact.status).toBe('unavailable');
    expect(registrationArtifact.stored_in_open_design).toBe(false);
    expect(registrationArtifact).toHaveProperty('sha256');
    expect(registrationArtifact).not.toHaveProperty('content_base64');

    const finalMetadata = recordField(firstTrace(calls[3]?.init), 'metadata');
    const finalArtifact = firstRecord(
      finalMetadata.artifact_manifest,
      'final artifact manifest',
    );
    expect(finalMetadata.manifest_completeness).toBe('complete');
    expect(finalArtifact.status).toBe('ok');
    expect(finalArtifact.stored_in_open_design).toBe(true);
    expect(finalArtifact.sha256).toBe('sha256:feedface');
    expect(finalArtifact).not.toHaveProperty('content_base64');
  });
});
