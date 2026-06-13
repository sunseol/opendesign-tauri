import { createHash } from 'node:crypto';
import path from 'node:path';

import { mimeFor, readProjectFile, resolveProjectFilePath } from './projects.js';
import {
  INPUT_MAX_BYTES,
  type BuildTraceObjectManifestsOptions,
  type ObjectRelayConfig,
  type TraceObjectSource,
} from './trace-object-manifest-types.js';

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

export function sha256(body: Buffer): string {
  return `sha256:${createHash('sha256').update(body).digest('hex')}`;
}

function objectId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 16)}`;
}

async function artifactSource(
  opts: BuildTraceObjectManifestsOptions,
  config: ObjectRelayConfig,
  artifactPath: string,
  type: string,
): Promise<TraceObjectSource> {
  const id = objectId('art', artifactPath);
  try {
    const fileInfo = await resolveProjectFilePath(
      opts.projectsRoot,
      opts.projectId,
      artifactPath,
      opts.projectMetadata ?? undefined,
    );
    if (fileInfo.size > config.objectMaxBytes) {
      return {
        objectClass: 'artifact',
        id,
        filename: fileInfo.name,
        mime: fileInfo.mime,
        type: type || fileInfo.kind,
        sizeBytes: fileInfo.size,
        reason: 'object_too_large',
        source: 'produced_file',
      };
    }
    const file = await readProjectFile(
      opts.projectsRoot,
      opts.projectId,
      artifactPath,
      opts.projectMetadata ?? undefined,
    );
    return {
      objectClass: 'artifact',
      id,
      filename: file.name,
      mime: file.mime,
      type: type || file.kind,
      body: file.buffer,
      sizeBytes: file.size,
      source: 'produced_file',
    };
  } catch {
    return {
      objectClass: 'artifact',
      id,
      filename: path.basename(artifactPath) || 'artifact.bin',
      mime: mimeFor(artifactPath),
      type,
      reason: 'source_read_failed',
      source: 'produced_file',
    };
  }
}

export async function collectTraceObjectSources(
  opts: BuildTraceObjectManifestsOptions,
  config: ObjectRelayConfig,
): Promise<TraceObjectSource[]> {
  const sources: TraceObjectSource[] = [];

  for (const artifactSourceItem of opts.artifacts ?? []) {
    const artifactPath = artifactSourceItem.sourcePath ?? artifactSourceItem.summary.slug;
    sources.push(await artifactSource(
      opts,
      config,
      artifactPath,
      artifactSourceItem.summary.type,
    ));
  }

  if (opts.prefs.content === true && byteLength(opts.prompt) > INPUT_MAX_BYTES) {
    const body = Buffer.from(opts.prompt, 'utf8');
    sources.push({
      objectClass: 'input_text_snapshot',
      id: objectId('input', `${opts.runId}:${sha256(body)}`),
      filename: 'input.txt',
      mime: 'text/plain; charset=utf-8',
      type: 'text',
      body,
      sizeBytes: body.byteLength,
      source: 'user_prompt',
      truncated: true,
    });
  }

  return sources;
}
