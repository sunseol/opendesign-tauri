import { describe, expect, it } from 'vitest';

import { runMcpInstallCli } from '../src/mcp-install-cli.js';

function makeOutput() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    deps: {
      stdout: (text: string) => stdout.push(text),
      stderr: (text: string) => stderr.push(text),
    },
  };
}

describe('od mcp install CLI', () => {
  it('uses daemon install-info for JSON-config dry runs', async () => {
    const output = makeOutput();
    const exitCode = await runMcpInstallCli(
      ['cursor', '--print', '--json', '--daemon-url', 'http://daemon.test'],
      {
        ...output.deps,
        home: '/home/u',
        platform: 'linux',
        readFile: async () => null,
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              command: '/node',
              args: ['/daemon/od.mjs', 'mcp'],
              env: { OD_DATA_DIR: '/data/open-design' },
            }),
          ),
      },
    );

    expect(exitCode).toBe(0);
    const body = JSON.parse(output.stdout[0] ?? '{}');
    expect(body).toMatchObject({
      ok: true,
      agent: 'cursor',
      kind: 'json',
      configPath: '/home/u/.cursor/mcp.json',
    });
    expect(body.preview).toContain('/daemon/od.mjs');
    expect(output.stderr).toEqual([]);
  });

  it('falls back to an od mcp command when the daemon is unreachable', async () => {
    const output = makeOutput();
    const exitCode = await runMcpInstallCli(
      ['codex', '--print', '--json', '--daemon-url', 'http://127.0.0.1:7456'],
      {
        ...output.deps,
        fetchImpl: async () => {
          throw new Error('offline');
        },
      },
    );

    expect(exitCode).toBe(0);
    const body = JSON.parse(output.stdout[0] ?? '{}');
    expect(body).toMatchObject({
      ok: true,
      agent: 'codex',
      kind: 'cli',
    });
    expect(body.command).toBe(
      'codex mcp add open-design -- od mcp --daemon-url http://127.0.0.1:7456',
    );
  });

  it('returns a command error for unknown agents', async () => {
    const output = makeOutput();
    const exitCode = await runMcpInstallCli(['not-real', '--json'], output.deps);

    expect(exitCode).toBe(2);
    const body = JSON.parse(output.stdout[0] ?? '{}');
    expect(body.ok).toBe(false);
    expect(body.message).toContain('unknown agent: not-real');
  });
});
