import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { collectSideFiles, derivePrompt } from './example.ts';

test('example plugin manifests prefer top-level skill example_prompt', () => {
  const prompt = derivePrompt({
    description: 'A long description that should not become the plugin use-case query.',
    example_prompt: 'Build a polished deck from the authored example prompt.',
  });

  assert.equal(prompt, 'Build a polished deck from the authored example prompt.');
});

test('example plugin manifests fall back to od.example_prompt before description snippets', () => {
  const prompt = derivePrompt({
    description: 'A long description that should not become the plugin use-case query.',
    od: {
      example_prompt: 'Create a focused artifact from od metadata.',
    },
  });

  assert.equal(prompt, 'Create a focused artifact from od metadata.');
});

test('example plugin migration carries restored skill side files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'od-example-plugin-side-files-'));
  const skillRoot = join(root, 'reference-design-contract');

  try {
    await mkdir(join(skillRoot, 'assets'), { recursive: true });
    await mkdir(join(skillRoot, 'references'), { recursive: true });
    await writeFile(join(skillRoot, 'example.html'), '<main>preview</main>\n', 'utf8');
    await writeFile(join(skillRoot, 'assets', 'agent.svg'), '<svg />\n', 'utf8');
    await writeFile(join(skillRoot, 'references', 'checklist.md'), '# checklist\n', 'utf8');
    await writeFile(
      join(skillRoot, 'references', 'evidence-model.md'),
      '# evidence model\n',
      'utf8',
    );
    await writeFile(join(skillRoot, 'references', 'ignored.bin'), 'binary\n', 'utf8');

    const summary = await collectSideFiles(skillRoot);
    const assets = new Set(summary.assets);

    assert.equal(summary.hasExample, true);
    assert.equal(assets.has('./example.html'), true);
    assert.equal(assets.has('./assets/agent.svg'), true);
    assert.equal(assets.has('./references/checklist.md'), true);
    assert.equal(assets.has('./references/evidence-model.md'), true);
    assert.equal(assets.has('./references/ignored.bin'), false);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
