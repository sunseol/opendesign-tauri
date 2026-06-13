import { describe, expect, it } from 'vitest';

import {
  PROMPT_STACK_PATH_MARKER,
  buildPromptStackFlatMetadata,
  buildPromptStackTelemetry,
  promptStackWithoutContent,
  structuredPromptStackInput,
} from '../src/prompt-telemetry.js';

describe('prompt telemetry builder', () => {
  it('redacts local paths and secrets before hashing or content capture', () => {
    const telemetry = buildPromptStackTelemetry({
      composedPrompt:
        'Use /Users/alice/work/repo/index.html with sk-test-1234567890123456789012.',
      sections: [{
        kind: 'daemonSystemPrompt',
        content:
          'Read /Users/alice/work/repo/index.html and token sk-test-1234567890123456789012.',
      }],
    });

    const section = telemetry.sections[0];
    expect(section?.redactedContent).toContain(PROMPT_STACK_PATH_MARKER);
    expect(section?.redactedContent).toContain('[REDACTED:sk_key]');
    expect(section?.redactedContent).not.toContain('/Users/alice');
    expect(section?.redactedContent).not.toContain('sk-test-');
    expect(section?.fingerprint).toMatch(/^sha256:/);
    expect(telemetry.promptFingerprint).toMatch(/^sha256:/);
  });

  it('keeps attachment sections metadata-only and strips content when requested', () => {
    const telemetry = buildPromptStackTelemetry({
      composedPrompt: 'Attach /tmp/reference.png',
      sections: [{
        kind: 'attachments',
        content: '/tmp/reference.png',
        metadata: [{ path: '/tmp/reference.png', size: 4096 }],
      }],
    });

    const section = telemetry.sections[0];
    expect(section?.contentMode).toBe('metadata-only');
    expect(section?.redactedContent).toBeUndefined();
    expect(section?.metadata).toMatchObject({
      count: 1,
      extensions: ['png'],
      knownSizeCount: 1,
    });

    const withoutContent = promptStackWithoutContent(telemetry);
    expect(withoutContent.redactedContentBytes).toBe(0);
    expect(withoutContent.sections[0]).not.toHaveProperty('redactedContent');
    expect(structuredPromptStackInput(withoutContent).sections[0])
      .not.toHaveProperty('redactedContent');
    expect(buildPromptStackFlatMetadata(telemetry)).toMatchObject({
      promptStack_redactionVersion: 'prompt-stack-redaction-v1',
      promptStack_sectionCount: 1,
    });
  });
});
