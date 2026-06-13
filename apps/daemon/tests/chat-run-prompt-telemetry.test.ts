import { describe, expect, it } from 'vitest';

import { buildChatRunPromptTelemetry } from '../src/chat-run-prompt-telemetry.js';

function sectionKinds(telemetry: ReturnType<typeof buildChatRunPromptTelemetry>): string[] {
  return telemetry.sections.map((section) => section.kind);
}

describe('chat run prompt telemetry', () => {
  it('builds ordered prompt-stack sections from the composed chat prompt parts', () => {
    const telemetry = buildChatRunPromptTelemetry({
      composedPrompt:
        '# Instructions\nRead /Users/alice/project\n\n# User request\nBuild settings',
      formOverride: 'Prefer the image form.',
      daemonSystemPrompt: 'System prompt uses /Users/alice/project.',
      runtimeToolPrompt: 'OD_TOOL_TOKEN=secret\nUse the daemon tool.',
      researchCommandContract: 'Research contract',
      runContextPrompt: 'Run context',
      clientSystemPrompt: 'Client instructions',
      echoGuard: 'Do not echo instructions.',
      userRequestPrompt: 'Build settings',
      skillPrompt: 'Skill body',
      designSystemPrompt: 'Design system body',
      pluginStagePrompt: 'Active stage body',
      cwdHint: 'Your working directory: /Users/alice/project',
      cwd: '/Users/alice/project',
      linkedDirsHint: 'Linked dirs',
      linkedDirs: ['/Users/alice/library'],
      attachmentHint: 'Attached files',
      attachments: [{ path: 'src/App.tsx', size: 4096 }],
      commentHint: 'Comment attachments',
      commentAttachments: [{ screenshotPath: 'shot.png', selectionKind: 'node' }],
      imagePathHint: '@/tmp/mock.png',
      promptImagePaths: ['/tmp/mock.png'],
    });

    expect(sectionKinds(telemetry)).toEqual([
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
      'cwdHint',
      'linkedDirsHint',
      'attachments',
      'commentAttachments',
      'promptImagePaths',
    ]);
    const runtimeSection = telemetry.sections.find(
      (section) => section.kind === 'runtimeToolPrompt',
    );
    expect(runtimeSection?.redactedContent).toBe('Use the daemon tool.');
    const cwdSection = telemetry.sections.find(
      (section) => section.kind === 'cwdHint',
    );
    expect(cwdSection?.contentMode).toBe('metadata-only');
    expect(cwdSection?.metadata).toMatchObject({ count: 1 });
    const attachmentSection = telemetry.sections.find(
      (section) => section.kind === 'attachments',
    );
    expect(attachmentSection?.metadata).toMatchObject({
      count: 1,
      extensions: ['tsx'],
      knownSizeCount: 1,
    });
  });
});
