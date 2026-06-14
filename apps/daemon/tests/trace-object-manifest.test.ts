import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildTraceObjectManifests } from '../src/trace-object-manifest.js';
import { readObjectRelayConfig } from '../src/trace-object-relay-client.js';

describe('readObjectRelayConfig', () => {
  it('derives authorize endpoint from an explicit object batch relay URL', () => {
    expect(readObjectRelayConfig({
      OPEN_DESIGN_OBJECT_RELAY_URL: 'https://telemetry.open-design.ai/api/objects/batch//',
    })).toMatchObject({
      url: 'https://telemetry.open-design.ai/api/objects/batch',
      authorizeUrl: 'https://telemetry.open-design.ai/api/objects/authorize',
    });
  });

  it('rejects explicit object relay URLs that are not batch endpoints', () => {
    expect(readObjectRelayConfig({
      OPEN_DESIGN_OBJECT_RELAY_URL: 'https://telemetry.open-design.ai/api/langfuse',
    })).toBeNull();
  });

  it('rejects telemetry relay URLs that are not Langfuse ingestion endpoints', () => {
    expect(readObjectRelayConfig({
      OPEN_DESIGN_TELEMETRY_RELAY_URL: 'https://telemetry.open-design.ai/health',
    })).toBeNull();
  });
});

describe('buildTraceObjectManifests', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'od-trace-objects-'));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('derives authorize and batch endpoints from the telemetry relay URL', async () => {
    const projectsRoot = path.join(dataDir, 'projects');
    const projectDir = path.join(projectsRoot, 'proj-1');
    await mkdir(projectDir, { recursive: true });
    await writeFile(path.join(projectDir, 'artifact.txt'), 'release artifact');

    const fetchSpy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      const parsed = JSON.parse(String(init?.body)) as {
        upload_token?: string;
        objects: Array<{ storage_ref: string; content_base64?: string }>;
      };
      expect(init?.headers).toMatchObject({
        'X-Open-Design-Telemetry': 'object-ingestion-v1',
      });

      if (href.includes('/api/objects/authorize')) {
        expect(parsed.objects).toHaveLength(1);
        expect(parsed.objects[0]).not.toHaveProperty('content_base64');
        return new Response(JSON.stringify({ upload_token: 'upload-token' }), { status: 200 });
      }

      expect(href).toBe('https://telemetry.open-design.ai/api/objects/batch');
      expect(parsed.upload_token).toBe('upload-token');
      expect(Buffer.from(parsed.objects[0]!.content_base64!, 'base64').toString('utf8'))
        .toBe('release artifact');
      return new Response(
        JSON.stringify({
          objects: parsed.objects.map((object) => ({
            storage_ref: object.storage_ref,
            status: 'available',
            size_bytes: Buffer.from(object.content_base64!, 'base64').byteLength,
            sha256: 'sha256:feedface',
          })),
        }),
        { status: 200 },
      );
    });

    const manifests = await buildTraceObjectManifests({
      installationId: 'install-1',
      projectId: 'proj-1',
      runId: 'run-1',
      projectsRoot,
      artifacts: [
        { summary: { slug: 'artifact.txt', type: 'text', sizeBytes: 'release artifact'.length } },
      ],
      prompt: 'prompt',
      prefs: { metrics: true, content: true, artifactManifest: true },
      fetchImpl: fetchSpy as typeof fetch,
      env: {
        OPEN_DESIGN_TELEMETRY_RELAY_URL: 'https://telemetry.open-design.ai/api/langfuse//',
      },
      now: () => new Date('2026-06-08T00:00:00.000Z'),
    });

    expect(fetchSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      'https://telemetry.open-design.ai/api/objects/authorize',
      'https://telemetry.open-design.ai/api/objects/batch',
    ]);
    expect(manifests?.completeness).toBe('complete');
    expect(manifests?.artifactManifest?.[0]).toMatchObject({
      status: 'ok',
      stored_in_open_design: true,
      size_bytes: 'release artifact'.length,
      sha256: 'sha256:feedface',
    });
  });

  it('builds registration-only manifests without contacting the relay', async () => {
    const projectsRoot = path.join(dataDir, 'projects');
    const projectDir = path.join(projectsRoot, 'proj-1');
    await mkdir(projectDir, { recursive: true });
    await writeFile(path.join(projectDir, 'artifact.txt'), 'release artifact');
    const fetchSpy = vi.fn();

    const manifests = await buildTraceObjectManifests({
      installationId: 'install-1',
      projectId: 'proj-1',
      runId: 'run-1',
      projectsRoot,
      artifacts: [
        { summary: { slug: 'artifact.txt', type: 'text', sizeBytes: 'release artifact'.length } },
      ],
      prompt: 'prompt',
      prefs: { metrics: true, content: true, artifactManifest: true },
      fetchImpl: fetchSpy as unknown as typeof fetch,
      env: {
        OPEN_DESIGN_OBJECT_RELAY_URL: 'https://telemetry.open-design.ai/api/objects/batch',
      },
      uploadMode: 'manifest-only',
      now: () => new Date('2026-06-08T00:00:00.000Z'),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(manifests?.completeness).toBe('partial');
    expect(manifests?.artifactManifest?.[0]).toMatchObject({
      status: 'unavailable',
      stored_in_open_design: false,
      size_bytes: 'release artifact'.length,
      sha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
    expect(manifests?.artifactManifest?.[0]).not.toHaveProperty('reason');
  });

  it('marks oversized objects unavailable without posting to the relay', async () => {
    const projectsRoot = path.join(dataDir, 'projects');
    const projectDir = path.join(projectsRoot, 'proj-1');
    await mkdir(projectDir, { recursive: true });
    await writeFile(path.join(projectDir, 'too-large.bin'), Buffer.alloc(16, 1));
    const fetchSpy = vi.fn();

    const manifests = await buildTraceObjectManifests({
      installationId: 'install-1',
      projectId: 'proj-1',
      runId: 'run-1',
      projectsRoot,
      artifacts: [
        { summary: { slug: 'too-large.bin', type: 'artifact', sizeBytes: 16 } },
      ],
      prompt: 'prompt',
      prefs: { metrics: true, content: true, artifactManifest: true },
      fetchImpl: fetchSpy as unknown as typeof fetch,
      env: {
        OPEN_DESIGN_OBJECT_RELAY_URL: 'https://telemetry.open-design.ai/api/objects/batch',
        OPEN_DESIGN_OBJECT_MAX_BYTES: '8',
      },
      now: () => new Date('2026-06-08T00:00:00.000Z'),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(manifests?.completeness).toBe('partial');
    expect(manifests?.artifactManifest?.[0]).toMatchObject({
      status: 'unavailable',
      reason: 'object_too_large',
      size_bytes: 16,
    });
  });
});
