import { describe, expect, it } from 'vitest';

import { buildDaemonTranscript } from '../../src/providers/daemon';
import type { ChatMessage } from '../../src/types';

function persistedArtifactFile(name = 'deck.html') {
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
      exports: [],
      metadata: { identifier: 'deck' },
    },
  } satisfies NonNullable<ChatMessage['producedFiles']>[number];
}

describe('daemon transcript artifact summaries', () => {
  it('summarizes persisted assistant artifacts instead of replaying their HTML bodies', () => {
    const transcript = buildDaemonTranscript([
      {
        id: '1',
        role: 'assistant',
        content:
          '<artifact identifier="deck" type="text/html" title="Pitch deck"><html><body>slide content</body></html></artifact>',
        producedFiles: [persistedArtifactFile()],
      },
    ]);

    expect(transcript).toContain('artifact emitted on a prior turn');
    expect(transcript).toContain('identifier="deck"');
    expect(transcript).toContain('"deck.html"');
    expect(transcript).not.toContain('slide content');
    expect(transcript).not.toContain('</artifact>');
  });

  it('keeps an assistant artifact body when persistence evidence is absent or inferred', () => {
    const content =
      '<artifact identifier="deck" type="text/html" title="Pitch deck"><html>only copy</html></artifact>';
    const inferredFile = {
      ...persistedArtifactFile(),
      artifactManifest: {
        ...persistedArtifactFile().artifactManifest,
        metadata: { identifier: 'deck', inferred: true },
      },
    } satisfies NonNullable<ChatMessage['producedFiles']>[number];

    for (const producedFiles of [undefined, [inferredFile]]) {
      const transcript = buildDaemonTranscript([
        {
          id: '1',
          role: 'assistant',
          content,
          producedFiles,
        },
      ]);

      expect(transcript).toContain('only copy');
      expect(transcript).not.toContain('artifact emitted on a prior turn');
    }
  });

  it('does not summarize artifact text in user messages', () => {
    const transcript = buildDaemonTranscript([
      {
        id: '1',
        role: 'user',
        content:
          'Explain <artifact identifier="deck" type="text/html" title="Pitch deck">literal</artifact>.',
        producedFiles: [persistedArtifactFile()],
      },
    ]);

    expect(transcript).toContain('<artifact identifier="deck"');
    expect(transcript).toContain('literal');
    expect(transcript).not.toContain('artifact emitted on a prior turn');
  });
});
