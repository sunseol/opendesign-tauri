import { describe, expect, it } from 'vitest';

import {
  AGENT_SLUGS,
  applyJsonInstall,
  isAgentSlug,
  planAgentInstall,
  removeJsonInstall,
  type JsonInstallPlan,
  type McpLaunchSpec,
} from '../src/mcp-agent-install.js';

const SPEC: McpLaunchSpec = {
  command: '/usr/local/bin/node',
  args: ['/opt/open-design/cli.js', 'mcp', '--daemon-url', 'http://127.0.0.1:7456'],
  env: { OD_DATA_DIR: '/home/u/.open-design' },
};

const SPEC_NO_ENV: McpLaunchSpec = { ...SPEC, env: {} };

function ctx(platform: NodeJS.Platform = 'linux') {
  return {
    home: '/home/u',
    platform,
    serverName: 'open-design',
  };
}

function expectJsonPlan(slug: Parameters<typeof planAgentInstall>[0]): JsonInstallPlan {
  const plan = planAgentInstall(slug, SPEC, ctx());
  if (plan.kind !== 'json') {
    throw new Error(`expected json plan for ${slug}`);
  }
  return plan;
}

describe('agent slug guard', () => {
  it('accepts every documented slug and rejects others', () => {
    for (const slug of AGENT_SLUGS) {
      expect(isAgentSlug(slug)).toBe(true);
    }
    expect(isAgentSlug('not-an-agent')).toBe(false);
    expect(AGENT_SLUGS).toHaveLength(14);
  });
});

describe('CLI-driven agents', () => {
  it('claude registers via claude mcp add with user scope and env flags', () => {
    const plan = planAgentInstall('claude', SPEC, ctx());
    expect(plan.kind).toBe('cli');
    if (plan.kind !== 'cli') {
      throw new Error('expected cli plan');
    }

    expect(plan.bin).toBe('claude');
    expect(plan.addArgv).toEqual([
      'mcp',
      'add',
      '--scope',
      'user',
      'open-design',
      '-e',
      'OD_DATA_DIR=/home/u/.open-design',
      '--',
      SPEC.command,
      ...SPEC.args,
    ]);
    expect(plan.removeArgv).toEqual(['mcp', 'remove', '--scope', 'user', 'open-design']);
  });

  it('codex uses env flags and a command separator', () => {
    const plan = planAgentInstall('codex', SPEC, ctx());
    if (plan.kind !== 'cli') {
      throw new Error('expected cli plan');
    }

    expect(plan.addArgv).toContain('--env');
    expect(plan.addArgv).toContain('OD_DATA_DIR=/home/u/.open-design');
    expect(plan.addArgv.slice(-SPEC.args.length - 2)).toEqual(['--', SPEC.command, ...SPEC.args]);
  });

  it('gemini keeps the command positional without a separator', () => {
    const plan = planAgentInstall('gemini', SPEC_NO_ENV, ctx());
    if (plan.kind !== 'cli') {
      throw new Error('expected cli plan');
    }

    expect(plan.addArgv).toEqual([
      'mcp',
      'add',
      '-s',
      'user',
      '-t',
      'stdio',
      'open-design',
      SPEC.command,
      ...SPEC.args,
    ]);
  });
});

describe('JSON-config agents', () => {
  it('cursor merges a stdio entry under mcpServers', () => {
    const plan = expectJsonPlan('cursor');

    expect(plan.configPath).toBe('/home/u/.cursor/mcp.json');
    expect(plan.keyPath).toEqual(['mcpServers']);
    expect(plan.entry).toEqual({
      command: SPEC.command,
      args: SPEC.args,
      type: 'stdio',
      env: SPEC.env,
    });
  });

  it('opencode folds command and args into one local command array', () => {
    const plan = expectJsonPlan('opencode');

    expect(plan.keyPath).toEqual(['mcp']);
    expect(plan.entry).toEqual({
      type: 'local',
      command: [SPEC.command, ...SPEC.args],
      enabled: true,
      environment: SPEC.env,
    });
  });

  it('openclaw nests under mcp.servers', () => {
    const plan = planAgentInstall('openclaw', SPEC_NO_ENV, ctx());
    if (plan.kind !== 'json') {
      throw new Error('expected json plan');
    }

    expect(plan.keyPath).toEqual(['mcp', 'servers']);
    expect(plan.entry).toEqual({ command: SPEC.command, args: SPEC.args });
  });

  it('omits env entirely when the launch spec has no env', () => {
    const plan = planAgentInstall('cursor', SPEC_NO_ENV, ctx());
    if (plan.kind !== 'json') {
      throw new Error('expected json plan');
    }

    expect(plan.entry).not.toHaveProperty('env');
  });

  it('cline path is OS-specific', () => {
    const mac = planAgentInstall('cline', SPEC, ctx('darwin'));
    const linux = planAgentInstall('cline', SPEC, ctx('linux'));
    if (mac.kind !== 'json' || linux.kind !== 'json') {
      throw new Error('expected json plans');
    }

    expect(mac.configPath).toContain('Library/Application Support/Code/User');
    expect(linux.configPath).toContain('.config/Code/User');
    expect(mac.configPath).toContain('saoudrizwan.claude-dev');
  });
});

describe('manual agents', () => {
  it('pi, vibe, and hermes never produce writable plans', () => {
    for (const slug of ['pi', 'vibe', 'hermes'] as const) {
      const plan = planAgentInstall(slug, SPEC, ctx());
      expect(plan.kind).toBe('manual');
      if (plan.kind !== 'manual') {
        throw new Error('expected manual plan');
      }
      expect(plan.snippet.length).toBeGreaterThan(0);
      expect(plan.reason.length).toBeGreaterThan(0);
    }
  });

  it('vibe snippet is TOML array-of-tables', () => {
    const plan = planAgentInstall('vibe', SPEC, ctx());
    if (plan.kind !== 'manual') {
      throw new Error('expected manual plan');
    }

    expect(plan.format).toBe('toml');
    expect(plan.snippet).toContain('[[mcp_servers]]');
    expect(plan.snippet).toContain('transport = "stdio"');
  });
});

describe('applyJsonInstall', () => {
  const plan = expectJsonPlan('cursor');

  it('creates the file structure from empty input', () => {
    const output = applyJsonInstall(null, plan);
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers['open-design'].command).toBe(SPEC.command);
    expect(output.endsWith('\n')).toBe(true);
  });

  it('preserves unrelated keys and sibling servers', () => {
    const existing = JSON.stringify({
      editor: { theme: 'dark' },
      mcpServers: { 'other-server': { command: 'foo' } },
    });

    const output = JSON.parse(applyJsonInstall(existing, plan));

    expect(output.editor).toEqual({ theme: 'dark' });
    expect(output.mcpServers['other-server']).toEqual({ command: 'foo' });
    expect(output.mcpServers['open-design'].type).toBe('stdio');
  });

  it('is idempotent', () => {
    const once = applyJsonInstall(null, plan);
    const twice = applyJsonInstall(once, plan);

    expect(twice).toBe(once);
  });

  it('throws on unparseable existing config rather than clobbering it', () => {
    expect(() => applyJsonInstall('{not json', plan)).toThrow(/not valid JSON/);
  });
});

describe('removeJsonInstall', () => {
  const plan = expectJsonPlan('cursor');

  it('removes only the open-design entry', () => {
    const existing = applyJsonInstall(
      JSON.stringify({ mcpServers: { other: { command: 'x' } } }),
      plan,
    );

    const removed = removeJsonInstall(existing, plan);
    expect(removed).not.toBeNull();
    const output = JSON.parse(removed ?? '{}');

    expect(output.mcpServers).not.toHaveProperty('open-design');
    expect(output.mcpServers.other).toEqual({ command: 'x' });
  });

  it('returns null when there is nothing to remove', () => {
    expect(removeJsonInstall(null, plan)).toBeNull();
    expect(removeJsonInstall('{}', plan)).toBeNull();
    expect(removeJsonInstall(JSON.stringify({ mcpServers: {} }), plan)).toBeNull();
  });
});
