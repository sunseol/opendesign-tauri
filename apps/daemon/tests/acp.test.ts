import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import { PassThrough } from 'node:stream';
import path from 'node:path';
import { test, vi } from 'vitest';
import { attachAcpSession, buildAcpSessionNewParams, normalizeModels } from '../src/acp.js';

const DEFAULT_MODEL_OPTION = { id: 'default', label: 'Default (CLI config)' };

test('ACP session params do not require MCP servers by default', () => {
  assert.deepEqual(buildAcpSessionNewParams('/tmp/od-project'), {
    cwd: path.resolve('/tmp/od-project'),
    mcpServers: [],
  });
});

test('ACP session params do not request global MCP config mutation', () => {
  const params = buildAcpSessionNewParams('/tmp/od-project');

  assert.equal('mcpConfigPath' in params, false);
  assert.equal('writeMcpConfig' in params, false);
  assert.equal('installMcpServers' in params, false);
});

test('ACP session params normalize explicit MCP servers to ACP stdio shape', () => {
  const mcpServers = [{ name: 'open-design-live-artifacts', command: 'od', args: ['mcp', 'live-artifacts'] }];

  assert.deepEqual(buildAcpSessionNewParams('/tmp/od-project', { mcpServers }), {
    cwd: path.resolve('/tmp/od-project'),
    mcpServers: [
      {
        type: 'stdio',
        name: 'open-design-live-artifacts',
        command: 'od',
        args: ['mcp', 'live-artifacts'],
        env: [],
      },
    ],
  });
});

test('ACP session params preserve caller-provided type and env fields', () => {
  const mcpServers = [
    { type: 'http', name: 'http-server', url: 'http://localhost:3000', headers: {}, env: [{ key: 'TOKEN', value: 'secret' }] },
  ];

  const result = buildAcpSessionNewParams('/tmp/od-project', { mcpServers });
  const server = result.mcpServers[0];
  assert.ok(server);
  assert.equal(server.type, 'http');
  assert.equal(server.name, 'http-server');
  assert.deepEqual(server.env, [{ key: 'TOKEN', value: 'secret' }]);
});

test('ACP session params can emit MCP env as a map for Reasonix-compatible agents', () => {
  const mcpServers = [
    {
      name: 'open-design-live-artifacts',
      command: 'od',
      args: ['mcp', 'live-artifacts'],
      env: [{ name: 'ELECTRON_RUN_AS_NODE', value: '1' }],
    },
  ];

  const result = buildAcpSessionNewParams('/tmp/od-project', {
    mcpServers,
    envFormat: 'map',
  });

  assert.deepEqual(result.mcpServers[0]?.env, { ELECTRON_RUN_AS_NODE: '1' });
});

test('ACP session params convert map env back to arrays for default ACP agents', () => {
  const mcpServers = [
    {
      name: 'open-design-live-artifacts',
      command: 'od',
      args: ['mcp', 'live-artifacts'],
      env: { ELECTRON_RUN_AS_NODE: '1' },
    },
  ];

  const result = buildAcpSessionNewParams('/tmp/od-project', { mcpServers });

  assert.deepEqual(result.mcpServers[0]?.env, [
    { name: 'ELECTRON_RUN_AS_NODE', value: '1' },
  ]);
});

test('ACP model normalization prefers session configOptions models', () => {
  const models = normalizeModels(
    {
      currentModelId: 'legacy-model',
      availableModels: [{ modelId: 'legacy-model', name: 'Legacy Model' }],
    },
    DEFAULT_MODEL_OPTION,
    [
      {
        id: 'model',
        type: 'select',
        category: 'model',
        currentValue: 'swe-1-6-fast',
        options: [
          { value: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 Thinking' },
          { id: 'swe-1-6-fast', name: 'SWE-1.6 Fast' },
        ],
      },
    ],
  );

  assert.deepEqual(models, [
    DEFAULT_MODEL_OPTION,
    {
      id: 'claude-opus-4-6-thinking',
      label: 'Claude Opus 4.6 Thinking (claude-opus-4-6-thinking)',
    },
    {
      id: 'swe-1-6-fast',
      label: 'SWE-1.6 Fast (swe-1-6-fast) • current',
    },
  ]);
});

test('ACP model normalization accepts category-less model configOptions', () => {
  const models = normalizeModels(null, DEFAULT_MODEL_OPTION, [
    {
      id: 'models',
      type: 'select',
      name: 'Model',
      currentValue: 'swe-1-6-fast',
      options: [
        { value: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 Thinking' },
        { value: 'swe-1-6-fast', name: 'SWE-1.6 Fast' },
      ],
    },
  ]);

  assert.deepEqual(models, [
    DEFAULT_MODEL_OPTION,
    {
      id: 'claude-opus-4-6-thinking',
      label: 'Claude Opus 4.6 Thinking (claude-opus-4-6-thinking)',
    },
    {
      id: 'swe-1-6-fast',
      label: 'SWE-1.6 Fast (swe-1-6-fast) • current',
    },
  ]);
});

test('attachAcpSession sets selected models through ACP config options', () => {
  const child = new FakeAcpChild();
  const writes: string[] = [];
  const events: Array<{ event: string; payload: unknown }> = [];
  child.stdin.on('data', (chunk) => writes.push(String(chunk)));

  attachAcpSession({
    child: child as never,
    prompt: 'hello',
    cwd: '/tmp/od-project',
    model: 'claude-opus-4-6-thinking',
    mcpServers: [],
    send: (event, payload) => events.push({ event, payload }),
  });

  writeAcpResult(child, 1, {});
  writeAcpResult(child, 2, {
    sessionId: 'session-1',
    configOptions: [
      {
        id: 'models',
        type: 'select',
        name: 'Model',
        currentValue: 'swe-1-6-fast',
        options: [
          { value: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 Thinking' },
          { value: 'swe-1-6-fast', name: 'SWE-1.6 Fast' },
        ],
      },
    ],
  });
  writeAcpResult(child, 3, {
    configOptions: [
      {
        id: 'models',
        type: 'select',
        name: 'Model',
        currentValue: 'claude-opus-4-6-thinking',
        options: [],
      },
    ],
  });
  writeAcpResult(child, 4, { usage: { inputTokens: 1, outputTokens: 2 } });

  const requests = parseRpcWrites(writes);
  const configRequest = requests.find((entry) => entry.method === 'session/set_config_option');
  assert.deepEqual(configRequest?.params, {
    sessionId: 'session-1',
    configId: 'models',
    value: 'claude-opus-4-6-thinking',
  });
  assert.equal(requests.some((entry) => entry.method === 'session/set_model'), false);
  assert.deepEqual(agentModelStatuses(events), [
    'swe-1-6-fast',
    'claude-opus-4-6-thinking',
  ]);
});

test('attachAcpSession keeps legacy session/set_model when no model config option exists', () => {
  const child = new FakeAcpChild();
  const writes: string[] = [];
  child.stdin.on('data', (chunk) => writes.push(String(chunk)));

  attachAcpSession({
    child: child as never,
    prompt: 'hello',
    cwd: '/tmp/od-project',
    model: 'legacy-model',
    mcpServers: [],
    send: () => {},
  });

  writeAcpResult(child, 1, {});
  writeAcpResult(child, 2, {
    sessionId: 'session-1',
    models: { currentModelId: 'default' },
  });
  writeAcpResult(child, 3, { models: { currentModelId: 'legacy-model' } });
  writeAcpResult(child, 4, {});

  const requests = parseRpcWrites(writes);
  const setModelRequest = requests.find((entry) => entry.method === 'session/set_model');
  assert.deepEqual(setModelRequest?.params, {
    sessionId: 'session-1',
    modelId: 'legacy-model',
  });
  assert.equal(requests.some((entry) => entry.method === 'session/set_config_option'), false);
});

test('attachAcpSession includes image attachments as ACP resource links', () => {
  const child = new FakeAcpChild();
  const writes: string[] = [];
  child.stdin.on('data', (chunk) => writes.push(String(chunk)));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'od-acp-image-'));
  const imagePath = path.join(tmpDir, 'screenshot.png');
  fs.writeFileSync(imagePath, 'png');

  attachAcpSession({
    child: child as never,
    prompt: 'describe this image',
    cwd: '/tmp/od-project',
    model: null,
    imagePaths: [imagePath],
    mcpServers: [],
    send: () => {},
  });

  writeAcpResult(child, 1, {});
  writeAcpResult(child, 2, { sessionId: 'session-1' });
  writeAcpResult(child, 3, {});

  const requests = parseRpcWrites(writes);
  const promptRequest = requests.find((entry) => entry.method === 'session/prompt');
  assert.deepEqual(promptRequest?.params, {
    sessionId: 'session-1',
    prompt: [
      { type: 'text', text: 'describe this image' },
      { type: 'resource_link', uri: imagePath },
    ],
  });
});

test('attachAcpSession suppresses raw artifact markup from message chunks', () => {
  const child = new FakeAcpChild();
  const events: Array<{ event: string; payload: unknown }> = [];

  attachAcpSession({
    child: child as never,
    prompt: 'build page',
    cwd: '/tmp/od-project',
    model: null,
    mcpServers: [],
    send: (event, payload) => events.push({ event, payload }),
  });

  child.stdout.write(`${JSON.stringify({ id: 1, result: {} })}\n`);
  child.stdout.write(`${JSON.stringify({ id: 2, result: { sessionId: 'session-1' } })}\n`);
  writeAcpUpdate(child, {
    sessionUpdate: 'agent_message_chunk',
    content: { text: 'Done\n\n<artifact identifier="page" type="text/html">' },
  });
  writeAcpUpdate(child, {
    sessionUpdate: 'agent_message_chunk',
    content: { text: '\n<!doctype html><html></html>\n</artifact>Tail' },
  });
  child.stdout.write(`${JSON.stringify({ id: 3, result: {} })}\n`);

  assert.deepEqual(textDeltas(events), ['Done\n\n', 'Tail']);
});

test('attachAcpSession suppresses split raw artifact open tags', () => {
  const child = new FakeAcpChild();
  const events: Array<{ event: string; payload: unknown }> = [];

  attachAcpSession({
    child: child as never,
    prompt: 'build page',
    cwd: '/tmp/od-project',
    model: null,
    mcpServers: [],
    send: (event, payload) => events.push({ event, payload }),
  });

  child.stdout.write(`${JSON.stringify({ id: 1, result: {} })}\n`);
  child.stdout.write(`${JSON.stringify({ id: 2, result: { sessionId: 'session-1' } })}\n`);
  writeAcpUpdate(child, {
    sessionUpdate: 'agent_message_chunk',
    content: { text: 'Done\n\n<art' },
  });
  writeAcpUpdate(child, {
    sessionUpdate: 'agent_message_chunk',
    content: { text: 'ifact identifier="page" type="text/html">raw' },
  });
  writeAcpUpdate(child, {
    sessionUpdate: 'agent_message_chunk',
    content: { text: '</artifact>Tail' },
  });
  child.stdout.write(`${JSON.stringify({ id: 3, result: {} })}\n`);

  assert.deepEqual(textDeltas(events), ['Done\n\n', 'Tail']);
});

test('attachAcpSession preserves inline literal artifact examples', () => {
  const child = new FakeAcpChild();
  const events: Array<{ event: string; payload: unknown }> = [];
  const literal = 'To show the syntax, write <artifact identifier="page">literal</artifact> in docs.';

  attachAcpSession({
    child: child as never,
    prompt: 'document artifact syntax',
    cwd: '/tmp/od-project',
    model: null,
    mcpServers: [],
    send: (event, payload) => events.push({ event, payload }),
  });

  writeAcpResult(child, 1, {});
  writeAcpResult(child, 2, { sessionId: 'session-1' });
  writeAcpUpdate(child, {
    sessionUpdate: 'agent_message_chunk',
    content: { text: literal },
  });
  writeAcpResult(child, 3, { usage: { inputTokens: 1, outputTokens: 2 } });

  assert.deepEqual(textDeltas(events), [literal]);
});

test('attachAcpSession converts cumulative ACP message snapshots into deltas', () => {
  const child = new FakeAcpChild();
  const events: Array<{ event: string; payload: unknown }> = [];

  attachAcpSession({
    child: child as never,
    prompt: 'describe the project',
    cwd: '/tmp/od-project',
    model: null,
    mcpServers: [],
    send: (event, payload) => events.push({ event, payload }),
  });

  writeAcpResult(child, 1, {});
  writeAcpResult(child, 2, { sessionId: 'session-1' });
  writeAcpUpdate(child, {
    sessionUpdate: 'agent_message_chunk',
    content: { text: 'Open Design' },
  });
  writeAcpUpdate(child, {
    sessionUpdate: 'agent_message_chunk',
    content: { text: 'Open Design - visual agent workspace' },
  });
  writeAcpUpdate(child, {
    sessionUpdate: 'agent_message_chunk',
    content: { text: 'Open Design - visual agent workspace' },
  });
  writeAcpResult(child, 3, { usage: { inputTokens: 1, outputTokens: 2 } });

  assert.deepEqual(textDeltas(events), ['Open Design', ' - visual agent workspace']);
});

test('attachAcpSession keeps incremental ACP message chunks unchanged', () => {
  const child = new FakeAcpChild();
  const events: Array<{ event: string; payload: unknown }> = [];

  attachAcpSession({
    child: child as never,
    prompt: 'describe the project',
    cwd: '/tmp/od-project',
    model: null,
    mcpServers: [],
    send: (event, payload) => events.push({ event, payload }),
  });

  writeAcpResult(child, 1, {});
  writeAcpResult(child, 2, { sessionId: 'session-1' });
  writeAcpUpdate(child, {
    sessionUpdate: 'agent_message_chunk',
    content: { text: 'Open Design' },
  });
  writeAcpUpdate(child, {
    sessionUpdate: 'agent_message_chunk',
    content: { text: ' - visual agent workspace' },
  });
  writeAcpResult(child, 3, { usage: { inputTokens: 1, outputTokens: 2 } });

  assert.deepEqual(textDeltas(events), ['Open Design', ' - visual agent workspace']);
});

test('attachAcpSession exposes abort and sends session cancel after session creation', () => {
  const child = new FakeAcpChild();
  const writes: string[] = [];
  child.stdin.on('data', (chunk) => writes.push(String(chunk)));

  const session = attachAcpSession({
    child: child as never,
    prompt: 'hello',
    cwd: '/tmp/od-project',
    model: null,
    mcpServers: [],
    send: () => {},
  });

  child.stdout.write(`${JSON.stringify({ id: 1, result: {} })}\n`);
  child.stdout.write(`${JSON.stringify({ id: 2, result: { sessionId: 'session-1' } })}\n`);

  assert.equal(typeof session.abort, 'function');
  session.abort();
  session.abort();

  const parsed = parseRpcWrites(writes);
  const cancelRequests = parsed.filter((entry) => entry.method === 'session/cancel');
  assert.equal(cancelRequests.length, 1);
  const cancelRequest = cancelRequests[0];
  assert.ok(cancelRequest);
  assert.deepEqual(cancelRequest.params, { sessionId: 'session-1' });
  assert.equal(child.stdin.writableEnded, true);
});

test('attachAcpSession closes stdin on abort before session creation', () => {
  const child = new FakeAcpChild();
  const writes: string[] = [];
  child.stdin.on('data', (chunk) => writes.push(String(chunk)));

  const session = attachAcpSession({
    child: child as never,
    prompt: 'hello',
    cwd: '/tmp/od-project',
    model: null,
    mcpServers: [],
    send: () => {},
  });

  assert.equal(typeof session.abort, 'function');
  session.abort();

  const parsed = parseRpcWrites(writes);
  assert.equal(parsed.some((entry) => entry.method === 'session/cancel'), false);
  assert.equal(child.stdin.writableEnded, true);
});

function parseRpcWrites(writes: string[]): Array<Record<string, unknown>> {
  return writes
    .join('')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function writeAcpResult(child: FakeAcpChild, id: number, result: unknown): void {
  child.stdout.write(`${JSON.stringify({ id, result })}\n`);
}

function writeAcpError(child: FakeAcpChild, id: number, error: unknown): void {
  child.stdout.write(`${JSON.stringify({ id, error })}\n`);
}

function writeAcpUpdate(child: FakeAcpChild, update: unknown): void {
  child.stdout.write(`${JSON.stringify({ method: 'session/update', params: { update } })}\n`);
}

function agentModelStatuses(events: Array<{ event: string; payload: unknown }>): unknown[] {
  return events
    .filter((entry) => {
      const payload = entry.payload as { type?: unknown; label?: unknown };
      return entry.event === 'agent' && payload.type === 'status' && payload.label === 'model';
    })
    .map((entry) => (entry.payload as { model?: unknown }).model);
}

function textDeltas(events: Array<{ event: string; payload: unknown }>): unknown[] {
  return events
    .filter((entry) => {
      const payload = entry.payload as { type?: unknown };
      return entry.event === 'agent' && payload.type === 'text_delta';
    })
    .map((entry) => (entry.payload as { delta?: unknown }).delta);
}

test('attachAcpSession accepts pretty-printed ACP startup responses', () => {
  const child = new FakeAcpChild();
  const writes: string[] = [];
  const events: Array<{ event: string; payload: unknown }> = [];
  child.stdin.on('data', (chunk) => writes.push(String(chunk)));

  attachAcpSession({
    child: child as never,
    prompt: 'hello',
    cwd: '/tmp/od-project',
    model: null,
    mcpServers: [],
    send: (event, payload) => events.push({ event, payload }),
  });

  child.stdout.write('{\n  "id": 1,\n  "result":\n  {}\n}\n');
  child.stdout.write('{\n  "id": 2,\n  "result":\n  {\n    "sessionId": "session-1"\n  }\n}\n');

  const methods = parseRpcWrites(writes)
    .map((entry) => entry.method)
    .filter(Boolean);
  assert.deepEqual(methods, ['initialize', 'session/new', 'session/prompt']);
  assert.equal(events.some((entry) => entry.event === 'error'), false);
});

test('attachAcpSession recovers when bracket-prefixed logs precede JSON frames', () => {
  const child = new FakeAcpChild();
  const writes: string[] = [];
  const events: Array<{ event: string; payload: unknown }> = [];
  child.stdin.on('data', (chunk) => writes.push(String(chunk)));

  attachAcpSession({
    child: child as never,
    prompt: 'hello',
    cwd: '/tmp/od-project',
    model: null,
    mcpServers: [],
    send: (event, payload) => events.push({ event, payload }),
  });

  child.stdout.write('[vela] starting OpenCode bridge\n');
  writeAcpResult(child, 1, {});
  child.stdout.write('{not json but looks like an object log\n');
  child.stdout.write('more startup text after the bad object log\n');
  writeAcpResult(child, 2, { sessionId: 'session-1' });

  const methods = parseRpcWrites(writes)
    .map((entry) => entry.method)
    .filter(Boolean);
  assert.deepEqual(methods, ['initialize', 'session/new', 'session/prompt']);
  assert.equal(events.some((entry) => entry.event === 'error'), false);
});

test('attachAcpSession does not fail a tool-only AMR turn that emits no assistant text', () => {
  const child = new FakeAcpChild();
  const events: Array<{ event: string; payload: unknown }> = [];

  attachAcpSession({
    child: child as never,
    prompt: 'change all card backgrounds to gray',
    cwd: '/tmp/od-project',
    model: null,
    mcpServers: [],
    modelUnavailableErrorCode: 'AMR_MODEL_UNAVAILABLE',
    send: (event, payload) => events.push({ event, payload }),
  });

  writeAcpResult(child, 1, {});
  writeAcpResult(child, 2, { sessionId: 'session-1' });
  writeAcpUpdate(child, {
    sessionUpdate: 'tool_call',
    toolCallId: 'tc-1',
    title: 'edit',
    status: 'pending',
  });
  writeAcpUpdate(child, {
    sessionUpdate: 'tool_call_update',
    toolCallId: 'tc-1',
    status: 'completed',
  });
  writeAcpResult(child, 3, { usage: { inputTokens: 1, outputTokens: 2 } });

  const errorEvents = events.filter((entry) => entry.event === 'error');
  assert.deepEqual(errorEvents, []);
});

test('attachAcpSession still fails an AMR turn that produces no text and no tool calls', () => {
  const child = new FakeAcpChild();
  const events: Array<{ event: string; payload: unknown }> = [];

  attachAcpSession({
    child: child as never,
    prompt: 'do something',
    cwd: '/tmp/od-project',
    model: null,
    mcpServers: [],
    modelUnavailableErrorCode: 'AMR_MODEL_UNAVAILABLE',
    send: (event, payload) => events.push({ event, payload }),
  });

  writeAcpResult(child, 1, {});
  writeAcpResult(child, 2, { sessionId: 'session-1' });
  writeAcpResult(child, 3, {});

  const errorEvents = events.filter((entry) => entry.event === 'error');
  assert.equal(errorEvents.length, 1);
  assert.match(
    (errorEvents[0]?.payload as { message?: string }).message ?? '',
    /without producing any assistant text/,
  );
});

test('attachAcpSession preserves structured OpenCode session error details from ACP failures', () => {
  const child = new FakeAcpChild();
  const events: Array<{ event: string; payload: unknown }> = [];

  attachAcpSession({
    child: child as never,
    prompt: 'hello',
    cwd: '/tmp/od-project',
    model: null,
    mcpServers: [],
    send: (event, payload) => events.push({ event, payload }),
  });

  const details = {
    kind: 'opencode_session_error',
    source: 'opencode',
    message: 'Not Found',
    statusCode: 404,
    retryable: false,
    url: 'https://example.invalid/v1/chat/completions',
    suggestion: 'Check the configured AMR Link URL or model route.',
  };

  writeAcpResult(child, 1, {});
  writeAcpResult(child, 2, { sessionId: 'session-1' });
  writeAcpError(child, 3, {
    code: -32600,
    message: 'OpenCode session failed: Not Found',
    data: details,
  });

  const errorEvents = events.filter((entry) => entry.event === 'error');
  assert.equal(errorEvents.length, 1);
  assert.deepEqual(errorEvents[0]?.payload, {
    message: 'json-rpc id 3: OpenCode session failed: Not Found',
    error: {
      code: 'AGENT_EXECUTION_FAILED',
      message: 'json-rpc id 3: OpenCode session failed: Not Found',
      retryable: false,
      details,
    },
  });
});

test('attachAcpSession promotes allowlisted OpenCode role-marker ACP errors', () => {
  const child = new FakeAcpChild();
  const events: Array<{ event: string; payload: unknown }> = [];

  attachAcpSession({
    child: child as never,
    prompt: 'hello',
    cwd: '/tmp/od-project',
    model: null,
    mcpServers: [],
    send: (event, payload) => events.push({ event, payload }),
  });

  const details = {
    kind: 'opencode_session_error',
    source: 'opencode',
    code: 'ROLE_MARKER_HALLUCINATION',
    upstream_name: 'RoleMarkerHallucinationError',
    message: 'Model emitted fabricated role marker ("## user"). Response was truncated to prevent unauthorized instruction injection.',
    marker: '## user',
    retryable: true,
  };

  writeAcpResult(child, 1, {});
  writeAcpResult(child, 2, { sessionId: 'session-1' });
  writeAcpError(child, 3, {
    code: -32600,
    message: 'OpenCode session failed: ROLE_MARKER_HALLUCINATION',
    data: details,
  });

  const errorEvents = events.filter((entry) => entry.event === 'error');
  assert.equal(errorEvents.length, 1);
  assert.deepEqual(errorEvents[0]?.payload, {
    message: details.message,
    error: {
      code: 'ROLE_MARKER_HALLUCINATION',
      message: details.message,
      retryable: true,
      details: {
        ...details,
        promoted_by: 'open_design_acp',
      },
    },
  });
});

test('attachAcpSession force-terminates the child after a clean prompt completion if it does not exit on stdin.end()', async () => {
  vi.useFakeTimers();
  try {
    const child = new FakeAcpChild();

    const session = attachAcpSession({
      child: child as never,
      prompt: 'hello',
      cwd: '/tmp/od-project',
      model: null,
      mcpServers: [],
      send: () => {},
    });

    // Drive the protocol through to a clean prompt completion.
    child.stdout.write(`${JSON.stringify({ id: 1, result: {} })}\n`);
    child.stdout.write(`${JSON.stringify({ id: 2, result: { sessionId: 'session-1' } })}\n`);
    child.stdout.write(`${JSON.stringify({ id: 3, result: { usage: { inputTokens: 1, outputTokens: 2 } } })}\n`);

    // Child has not exited yet (simulates Devin for Terminal keeping the
    // process alive past stdin.end()).
    assert.equal(child.killed, false);

    // After the grace period elapses, attachAcpSession should SIGTERM the
    // child so child.on('close') can fire and the chat run can finalize.
    await vi.advanceTimersByTimeAsync(500);
    assert.equal(child.killed, true);

    // The session reports the prompt completed successfully so the consumer
    // can mark the run as 'succeeded' even though the underlying exit was
    // signal-driven.
    assert.equal(session.completedSuccessfully(), true);
    assert.equal(session.hasFatalError(), false);
  } finally {
    vi.useRealTimers();
  }
});

test('attachAcpSession does not double-kill a child that exits cleanly on stdin.end()', async () => {
  vi.useFakeTimers();
  try {
    const child = new FakeAcpChild();

    attachAcpSession({
      child: child as never,
      prompt: 'hello',
      cwd: '/tmp/od-project',
      model: null,
      mcpServers: [],
      send: () => {},
    });

    child.stdout.write(`${JSON.stringify({ id: 1, result: {} })}\n`);
    child.stdout.write(`${JSON.stringify({ id: 2, result: { sessionId: 'session-1' } })}\n`);
    child.stdout.write(`${JSON.stringify({ id: 3, result: {} })}\n`);

    // Well-behaved agent exits on its own before the grace period elapses.
    child.emit('close', 0, null);
    assert.equal(child.killed, false);

    // The grace-period timer should have been cleared by the close handler,
    // so advancing time should not trigger a SIGTERM on the now-closed child.
    await vi.advanceTimersByTimeAsync(2_000);
    assert.equal(child.killed, false);
  } finally {
    vi.useRealTimers();
  }
});

test('attachAcpSession.completedSuccessfully reflects abort and fatal-error states', () => {
  const child = new FakeAcpChild();

  const session = attachAcpSession({
    child: child as never,
    prompt: 'hello',
    cwd: '/tmp/od-project',
    model: null,
    mcpServers: [],
    send: () => {},
  });

  // Before any protocol traffic the session is not yet complete.
  assert.equal(session.completedSuccessfully(), false);

  // Drive through session creation, then abort before the prompt completes.
  child.stdout.write(`${JSON.stringify({ id: 1, result: {} })}\n`);
  child.stdout.write(`${JSON.stringify({ id: 2, result: { sessionId: 'session-1' } })}\n`);
  session.abort();

  // Aborted runs are not "successful completions" even though `finished` is
  // set internally — the consumer should treat them as canceled, not
  // succeeded.
  assert.equal(session.completedSuccessfully(), false);
});

test('attachAcpSession default stage timeout tolerates >3min of silence between chunks', async () => {
  vi.useFakeTimers();
  try {
    const child = new FakeAcpChild();
    const events: Array<{ event: string; payload: unknown }> = [];

    attachAcpSession({
      child: child as never,
      prompt: 'write a large landing page',
      cwd: '/tmp/od-project',
      model: null,
      mcpServers: [],
      send: (event, payload) => events.push({ event, payload }),
    });

    child.stdout.write(`${JSON.stringify({ id: 1, result: {} })}\n`);
    child.stdout.write(`${JSON.stringify({ id: 2, result: { sessionId: 'session-1' } })}\n`);

    // Simulate an agent silently writing a large artifact for ~4 minutes —
    // longer than the historical 180_000ms default that killed long
    // generations mid-response.
    await vi.advanceTimersByTimeAsync(240_000);

    const errors = events.filter((e) => e.event === 'error');
    assert.equal(errors.length, 0, `expected no stage-timeout error, got: ${JSON.stringify(errors)}`);
    assert.equal(child.killed, false);
  } finally {
    vi.useRealTimers();
  }
});

test('attachAcpSession honors caller-supplied stageTimeoutMs override', async () => {
  vi.useFakeTimers();
  try {
    const child = new FakeAcpChild();
    const events: Array<{ event: string; payload: unknown }> = [];

    attachAcpSession({
      child: child as never,
      prompt: 'hello',
      cwd: '/tmp/od-project',
      model: null,
      mcpServers: [],
      send: (event, payload) => events.push({ event, payload }),
      stageTimeoutMs: 1_000,
    });

    child.stdout.write(`${JSON.stringify({ id: 1, result: {} })}\n`);
    child.stdout.write(`${JSON.stringify({ id: 2, result: { sessionId: 'session-1' } })}\n`);

    await vi.advanceTimersByTimeAsync(1_500);

    const error = events.find((e) => e.event === 'error');
    assert.ok(error, 'expected a stage-timeout error event');
    const message = (error.payload as { message?: string }).message ?? '';
    assert.match(message, /1000ms/);
  } finally {
    vi.useRealTimers();
  }
});

test('attachAcpSession treats stageTimeoutMs <= 0 as a watchdog disable, not an immediate-failure schedule', async () => {
  vi.useFakeTimers();
  try {
    const child = new FakeAcpChild();
    const events: Array<{ event: string; payload: unknown }> = [];

    attachAcpSession({
      child: child as never,
      prompt: 'hello',
      cwd: '/tmp/od-project',
      model: null,
      mcpServers: [],
      send: (event, payload) => events.push({ event, payload }),
      // OD_ACP_STAGE_TIMEOUT_MS=0 escape hatch: operator wants to disable the
      // inner stage watchdog entirely (e.g. when relying solely on the outer
      // chat inactivity watchdog). Must NOT schedule a 0ms setTimeout that
      // would fail every ACP session on the next tick.
      stageTimeoutMs: 0,
    });

    // Drive past where the next-tick failure would have fired, plus a long
    // silent period that would trip any positive default watchdog.
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    const errors = events.filter((e) => e.event === 'error');
    assert.equal(
      errors.length,
      0,
      `expected stageTimeoutMs=0 to disable the watchdog, got: ${JSON.stringify(errors)}`,
    );
    assert.equal(child.killed, false);
  } finally {
    vi.useRealTimers();
  }
});

class FakeAcpChild extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  killed = false;

  kill() {
    this.killed = true;
    return true;
  }
}
