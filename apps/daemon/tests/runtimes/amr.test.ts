import { test } from 'vitest';
import {
  AGENT_DEFS,
  amr,
  assert,
  chmodSync,
  detectAgents,
  join,
  mkdtempSync,
  rmSync,
  tmpdir,
  withEnvSnapshot,
  writeFileSync,
} from './helpers/test-helpers.js';
import {
  fetchVelaPresetModels,
  normalizeVelaModelId,
  parseVelaModelJson,
} from '../../src/runtimes/defs/amr.js';

test('amr registers Vela ACP runtime metadata', () => {
  assert.equal(AGENT_DEFS[0]?.id, 'amr');
  assert.equal(amr.name, 'AMR');
  assert.equal(amr.bin, 'vela');
  assert.equal(amr.streamFormat, 'acp-json-rpc');
  assert.equal(amr.externalMcpInjection, 'acp-merge');
  assert.equal(amr.supportsCustomModel, false);
  assert.equal(amr.supportsImagePaths, true);
  assert.deepEqual(amr.fallbackModels, []);
  assert.deepEqual(amr.buildArgs('', [], [], {}), [
    'agent',
    'run',
    '--runtime',
    'opencode',
  ]);
});

test('amr normalizes Vela public model identifiers for ACP set_model', () => {
  assert.equal(normalizeVelaModelId('public_model_deepseek_v3_2'), 'deepseek-v3.2');
  assert.equal(normalizeVelaModelId('vela/public_model_glm_5_1'), 'glm-5.1');
  assert.equal(normalizeVelaModelId('public_model_kimi_k2_6'), 'kimi-k2.6');
  assert.equal(normalizeVelaModelId('public_model_gpt_5_1'), 'gpt-5.1');
  assert.equal(normalizeVelaModelId('  '), null);
});

test('amr parses remote Vela model JSON, filters media models, and orders chat defaults first', () => {
  const models = parseVelaModelJson(
    JSON.stringify({
      source: 'remote',
      data: [
        { id: 'qwen3-coder-plus' },
        { id: 'gpt-image-2' },
        { id: 'deepseek-v3.2' },
        { id: 'glm-5.1' },
        { id: 'deepseek-v3.2' },
      ],
    }),
    'remote',
  );

  assert.deepEqual(models.map((model) => model.id), [
    'deepseek-v3.2',
    'glm-5.1',
    'qwen3-coder-plus',
  ]);
});

test('amr parses preset Vela model JSON', () => {
  const models = parseVelaModelJson(
    JSON.stringify({
      source: 'preset',
      data: [
        { id: 'gemini-2.5-flash' },
        { id: 'gpt-image-2' },
        { id: 'deepseek-v4-flash' },
      ],
    }),
    'preset',
  );

  assert.deepEqual(models.map((model) => model.id), [
    'deepseek-v4-flash',
    'gemini-2.5-flash',
  ]);
});

test('fetchVelaPresetModels calls vela model preset JSON', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'od-amr-preset-'));
  try {
    const vela = join(dir, 'vela');
    writeFileSync(
      vela,
      [
        '#!/bin/sh',
        'if [ "$1" = "model" ] && [ "$2" = "preset" ]; then',
        '  echo \'{"source":"preset","data":[{"id":"glm-5.1"},{"id":"deepseek-v4-flash"}]}\'',
        '  exit 0',
        'fi',
        'exit 1',
        '',
      ].join('\n'),
    );
    chmodSync(vela, 0o755);

    const models = await fetchVelaPresetModels(vela, {});

    assert.deepEqual(models.map((model) => model.id), [
      'deepseek-v4-flash',
      'glm-5.1',
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('detectAgents exposes AMR install metadata when Vela is missing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'od-amr-missing-'));
  try {
    return await withEnvSnapshot(['PATH', 'OD_AGENT_HOME'], async () => {
      process.env.PATH = dir;
      process.env.OD_AGENT_HOME = dir;

      const agents = await detectAgents();
      const detected = agents.find((agent) => agent.id === 'amr');

      assert.ok(detected);
      assert.equal(detected.available, false);
      assert.equal(detected.installUrl, 'https://open-design.ai/amr');
      assert.equal(
        detected.docsUrl,
        'https://github.com/nexu-io/open-design/blob/main/docs/new-agent-runtime-acp.md',
      );
      assert.deepEqual(detected.models, []);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('detectAgents falls back to AMR preset models when the remote catalog fails', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'od-amr-preset-fallback-'));
  try {
    return await withEnvSnapshot(['PATH', 'OD_AGENT_HOME'], async () => {
      const vela = join(dir, 'vela');
      writeFileSync(
        vela,
        [
          '#!/bin/sh',
          'if [ "$1" = "--version" ]; then echo "vela 0.0.16"; exit 0; fi',
          'if [ "$1" = "model" ] && [ "$2" = "list" ]; then',
          '  echo "deadline exceeded" >&2',
          '  exit 1',
          'fi',
          'if [ "$1" = "model" ] && [ "$2" = "preset" ]; then',
          '  echo \'{"source":"preset","data":[{"id":"glm-5.1"},{"id":"deepseek-v4-flash"}]}\'',
          '  exit 0',
          'fi',
          'exit 1',
          '',
        ].join('\n'),
      );
      chmodSync(vela, 0o755);
      process.env.PATH = dir;
      process.env.OD_AGENT_HOME = dir;

      const agents = await detectAgents();
      const detected = agents.find((agent) => agent.id === 'amr');

      assert.ok(detected);
      assert.equal(detected.available, true);
      assert.equal(detected.modelsSource, 'live');
      assert.deepEqual(detected.models.map((model) => model.id), [
        'deepseek-v4-flash',
        'glm-5.1',
      ]);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('detectAgents reads live AMR models from Vela when available', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'od-amr-available-'));
  try {
    return await withEnvSnapshot(['PATH', 'OD_AGENT_HOME'], async () => {
      const vela = join(dir, 'vela');
      writeFileSync(
        vela,
        [
          '#!/bin/sh',
          'if [ "$1" = "--version" ]; then echo "vela 0.0.16"; exit 0; fi',
          'if [ "$1" = "model" ] && [ "$2" = "list" ]; then',
          '  echo \'{"source":"remote","data":[{"id":"qwen3-coder-plus"},{"id":"deepseek-v4-flash"}]}\'',
          '  exit 0',
          'fi',
          'exit 1',
          '',
        ].join('\n'),
      );
      chmodSync(vela, 0o755);
      process.env.PATH = dir;
      process.env.OD_AGENT_HOME = dir;

      const agents = await detectAgents();
      const detected = agents.find((agent) => agent.id === 'amr');

      assert.ok(detected);
      assert.equal(detected.available, true);
      assert.equal(detected.version, 'vela 0.0.16');
      assert.equal(detected.modelsSource, 'live');
      assert.deepEqual(detected.models.map((model) => model.id), [
        'deepseek-v4-flash',
        'qwen3-coder-plus',
      ]);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
