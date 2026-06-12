#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { argv, env, exit, stderr, stdout } from 'node:process';

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
} else {
  stderr.write(`unsupported fake vela command: ${argv.slice(2).join(' ')}\n`);
  exit(1);
}
