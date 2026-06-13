import { describe, expect, it } from 'vitest';

import { runDesignSystemsCli, type DesignSystemsCliDeps } from '../src/design-systems-cli.js';

class CliExit extends Error {
  readonly name = 'CliExit';

  constructor(readonly code: number) {
    super(`exit ${code}`);
  }
}

describe('runDesignSystemsCli', () => {
  it('prints the design-systems usage for help without hitting the daemon', async () => {
    const calls: string[] = [];
    const deps = testDeps({
      log: (message) => calls.push(message),
      exit: (code) => {
        throw new CliExit(code);
      },
    });

    await expect(runDesignSystemsCli(['--help'], deps)).rejects.toMatchObject({ code: 0 });

    expect(calls.join('\n')).toContain('import-shadcn');
    expect(deps.fetchCalls).toEqual([]);
  });

  it('patches an editable design-system title for rename', async () => {
    const deps = testDeps();

    await runDesignSystemsCli(['rename', 'user:acme', '--title', 'Acme v2', '--json'], deps);

    expect(deps.fetchCalls).toEqual([
      {
        url: 'http://daemon.test/api/design-systems/user%3Aacme',
        init: {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Acme v2' }),
        },
      },
    ]);
    expect(deps.output.join('')).toContain('"title": "Acme v2"');
  });

  it('posts shadcn imports through the dedicated daemon endpoint', async () => {
    const deps = testDeps();

    await runDesignSystemsCli([
      'import-shadcn',
      'shadcn/ui/theme-zinc',
      '--name',
      'Zinc Theme',
      '--import-mode',
      'hybrid',
      '--craft',
      'color,type',
      '--json',
    ], deps);

    expect(deps.fetchCalls).toEqual([
      {
        url: 'http://daemon.test/api/design-systems/import/shadcn',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: 'shadcn/ui/theme-zinc',
            name: 'Zinc Theme',
            importMode: 'hybrid',
            craftApplies: ['color', 'type'],
          }),
        },
      },
    ]);
  });
});

function testDeps(overrides: Partial<DesignSystemsCliDeps['io']> = {}) {
  const fetchCalls: Array<{ readonly url: string; readonly init: RequestInit | undefined }> = [];
  const output: string[] = [];
  const deps: DesignSystemsCliDeps & {
    readonly fetchCalls: typeof fetchCalls;
    readonly output: typeof output;
  } = {
    fetchImpl: async (url, init) => {
      fetchCalls.push({ url: String(url), init });
      return new Response(JSON.stringify({ designSystem: { id: 'user:acme', title: 'Acme v2' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
    libraryDaemonUrl: async () => 'http://daemon.test',
    runLibraryList: async () => {
      throw new Error('runLibraryList should not be called');
    },
    structuredHttpFailure: async () => {
      throw new Error('structuredHttpFailure should not be called');
    },
    io: {
      log: () => undefined,
      error: () => undefined,
      write: (message) => output.push(message),
      exit: (code) => {
        throw new CliExit(code);
      },
      ...overrides,
    },
    fetchCalls,
    output,
  };
  return deps;
}
