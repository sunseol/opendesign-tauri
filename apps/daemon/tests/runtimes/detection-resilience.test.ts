import { afterEach, expect, test, vi } from 'vitest';

vi.mock('../../src/runtimes/launch.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/runtimes/launch.js')>();
  return {
    ...actual,
    resolveAgentLaunch: vi.fn(actual.resolveAgentLaunch),
    applyAgentLaunchEnv: vi.fn(actual.applyAgentLaunchEnv),
  };
});

import * as launchModule from '../../src/runtimes/launch.js';
import { detectAgents } from '../../src/runtimes/detection.js';
import { AGENT_DEFS } from '../../src/runtimes/registry.js';

const mockedResolveAgentLaunch = vi.mocked(launchModule.resolveAgentLaunch);
const mockedApplyAgentLaunchEnv = vi.mocked(launchModule.applyAgentLaunchEnv);
const originalResolveImpl = mockedResolveAgentLaunch.getMockImplementation()!;
const originalApplyImpl = mockedApplyAgentLaunchEnv.getMockImplementation()!;

afterEach(() => {
  mockedResolveAgentLaunch.mockImplementation(originalResolveImpl);
  mockedApplyAgentLaunchEnv.mockImplementation(originalApplyImpl);
});

test('detectAgents isolates a single agent launch-resolution throw', async () => {
  mockedResolveAgentLaunch.mockImplementation((def, env) => {
    if (def.id === 'claude') {
      throw new Error('synthetic FS throw during PATH walk');
    }
    return originalResolveImpl(def, env);
  });

  const agents = await detectAgents();

  expect(agents.length).toBe(AGENT_DEFS.length);
  const claude = agents.find((a) => a.id === 'claude');
  expect(claude).toBeDefined();
  expect(claude?.available).toBe(false);
  expect(agents.filter((a) => a.id !== 'claude').length).toBe(AGENT_DEFS.length - 1);
});

test('detectAgents isolates a probe throw from applyAgentLaunchEnv', async () => {
  let thrown = false;
  mockedApplyAgentLaunchEnv.mockImplementation((env, launch, nodeBinDir) => {
    if (!thrown) {
      thrown = true;
      throw new Error('synthetic env construction error');
    }
    return originalApplyImpl(env, launch, nodeBinDir);
  });

  const agents = await detectAgents();

  expect(agents.length).toBe(AGENT_DEFS.length);
  expect(agents.some((a) => a.available === false)).toBe(true);
});
