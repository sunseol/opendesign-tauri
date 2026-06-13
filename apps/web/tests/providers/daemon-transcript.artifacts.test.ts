import { describe, expect, it } from 'vitest';

import { buildDaemonTranscript } from '../../src/providers/daemon';
import type { ChatMessage, ProjectFile } from '../../src/types';

function assistantTurn(content: string, producedFiles?: ProjectFile[]): ChatMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content,
    ...(producedFiles ? { producedFiles } : {}),
  };
}

function persistedArtifactFile(
  name: string,
  options: { identifier?: string; inferred?: boolean } = {},
): ProjectFile {
  const metadata: NonNullable<NonNullable<ProjectFile['artifactManifest']>['metadata']> = {};
  if (options.identifier) metadata.identifier = options.identifier;
  if (options.inferred) metadata.inferred = true;

  return {
    name,
    size: 100,
    mtime: 1,
    kind: 'html',
    mime: 'text/html',
    artifactManifest: {
      version: 1,
      kind: 'html',
      title: 'Pitch deck',
      entry: name,
      renderer: 'html',
      exports: ['html'],
      metadata,
    },
  };
}

describe('buildDaemonTranscript artifact summaries', () => {
  it('replaces a persisted prior-turn artifact with a compact disk reference', () => {
    const artifact = [
      'Build summary below.',
      '<artifact identifier="deck" type="text/html" title="Pitch deck">',
      '<!doctype html><html><body>slide content</body></html>',
      '</artifact>',
    ].join('\n');

    const transcript = buildDaemonTranscript([
      assistantTurn(artifact, [persistedArtifactFile('deck.html', { identifier: 'deck' })]),
    ]);

    expect(transcript).toContain('artifact emitted on a prior turn');
    expect(transcript).toContain('identifier="deck"');
    expect(transcript).toContain('title="Pitch deck"');
    expect(transcript).toContain('"deck.html"');
    expect(transcript).toContain('Build summary below.');
    expect(transcript).not.toContain('<!doctype html>');
    expect(transcript).not.toContain('slide content');
    expect(transcript).not.toContain('</artifact>');
  });

  it('keeps an artifact body when persistence is not confirmed', () => {
    const artifact = [
      '<artifact identifier="deck" type="text/html" title="Pitch deck">',
      '<html><body>only surviving copy</body></html>',
      '</artifact>',
    ].join('\n');

    const transcript = buildDaemonTranscript([assistantTurn(artifact)]);

    expect(transcript).toContain('only surviving copy');
    expect(transcript).toContain('<artifact identifier="deck"');
    expect(transcript).not.toContain('artifact emitted on a prior turn');
  });

  it('does not treat same-named tool-written files as artifact persistence evidence', () => {
    const artifact =
      '<artifact identifier="deck" type="text/html" title="Pitch deck"><html>only copy</html></artifact>';
    const toolWrittenFile: ProjectFile = {
      name: 'deck.html',
      size: 10,
      mtime: 1,
      kind: 'html',
      mime: 'text/html',
    };

    for (const producedFile of [
      toolWrittenFile,
      persistedArtifactFile('deck.html', { identifier: 'deck', inferred: true }),
    ]) {
      const transcript = buildDaemonTranscript([assistantTurn(artifact, [producedFile])]);
      expect(transcript).toContain('only copy');
      expect(transcript).not.toContain('artifact emitted on a prior turn');
    }
  });

  it('leaves literal artifact examples inside code fences intact', () => {
    const content = [
      'Here is how the artifact protocol looks:',
      '```html',
      '<artifact identifier="deck" type="text/html" title="Pitch deck">...</artifact>',
      '```',
    ].join('\n');

    const transcript = buildDaemonTranscript([
      assistantTurn(content, [persistedArtifactFile('deck.html', { identifier: 'deck' })]),
    ]);

    expect(transcript).toContain('<artifact identifier="deck"');
    expect(transcript).toContain('```html');
    expect(transcript).not.toContain('artifact emitted on a prior turn');
  });

  it('does not summarize artifacts quoted by the user', () => {
    const transcript = buildDaemonTranscript([
      {
        id: 'user-1',
        role: 'user',
        content:
          'What does <artifact identifier="deck" type="text/html" title="Pitch deck">...</artifact> mean?',
      },
    ]);

    expect(transcript).toContain('<artifact identifier="deck"');
    expect(transcript).not.toContain('artifact emitted on a prior turn');
  });
});
