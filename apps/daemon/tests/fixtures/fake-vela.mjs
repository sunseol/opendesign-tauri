#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { argv, env, exit, stdin, stderr, stdout } from 'node:process';

function loginAndExit() {
  if (env.FAKE_VELA_LOGIN_FAIL) {
    stderr.write(`${env.FAKE_VELA_LOGIN_FAIL}\n`);
    exit(1);
  }

  const profile = (env.VELA_PROFILE || 'prod').trim() || 'prod';
  const allowed = new Set(['prod', 'test', 'local']);
  const profileName = allowed.has(profile) ? profile : 'prod';
  const delayMs = Number(env.FAKE_VELA_LOGIN_DELAY_MS) || 0;
  const userEmail = env.FAKE_VELA_LOGIN_USER_EMAIL || 'fake-user@example.com';
  const userPlan = env.FAKE_VELA_LOGIN_USER_PLAN || 'free';

  const finish = () => {
    const file = join(homedir(), '.amr', 'config.json');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify(
        {
          profiles: {
            [profileName]: {
              controlKey: 'fake-control-key',
              runtimeKey: 'fake-runtime-key',
              apiUrl: profileName === 'local' ? 'http://localhost:18080' : '',
              linkUrl: profileName === 'local' ? 'http://localhost:18081' : '',
              user: {
                id: 'fake-user-id',
                email: userEmail,
                name: 'Fake User',
                plan: userPlan,
              },
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );
    stdout.write(`Login successful for ${userEmail}.\n`);
    exit(0);
  };

  if (delayMs > 0) setTimeout(finish, delayMs);
  else finish();
}

if (argv[2] === '--version') {
  stdout.write('vela 0.0.16\n');
  exit(0);
}

if (argv[2] === 'login') {
  loginAndExit();
} else if (argv[2] === 'agent' && argv[3] === 'run') {
  runAcpSession();
} else {
  stderr.write(`unsupported fake vela command: ${argv.slice(2).join(' ')}\n`);
  exit(1);
}

function writeMessage(obj) {
  stdout.write(`${JSON.stringify(obj)}\n`);
}

function writeResult(id, result) {
  writeMessage({ jsonrpc: '2.0', id, result });
}

function writeError(id, message) {
  writeMessage({
    jsonrpc: '2.0',
    id,
    error: {
      code: -32603,
      message,
      data: {
        kind: 'opencode_session_error',
        message,
        retryable: false,
      },
    },
  });
}

function runAcpSession() {
  stdin.setEncoding('utf8');
  let buffer = '';
  stdin.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.method === 'initialize') {
        writeResult(msg.id, {
          protocolVersion: 1,
          agentCapabilities: { promptCapabilities: { embeddedContext: false } },
        });
      } else if (msg.method === 'session/new') {
        writeResult(msg.id, { sessionId: 'fake-vela-session' });
      } else if (
        msg.method === 'session/set_model' ||
        msg.method === 'session/set_config_option'
      ) {
        writeResult(msg.id, {});
      } else if (msg.method === 'session/prompt') {
        if (env.FAKE_VELA_PROMPT_ERROR) {
          writeError(msg.id, env.FAKE_VELA_PROMPT_ERROR);
        } else {
          writeMessage({
            jsonrpc: '2.0',
            method: 'session/update',
            params: {
              sessionId: 'fake-vela-session',
              update: {
                sessionUpdate: 'agent_message_chunk',
                content: { type: 'text', text: 'Hello from fake vela.' },
              },
            },
          });
          writeResult(msg.id, {
            stopReason: 'end_turn',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
        }
      } else if (typeof msg.id !== 'undefined') {
        writeError(msg.id, `unknown method: ${msg.method}`);
      }
    }
  });
}
