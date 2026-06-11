// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/App';
import {
  fetchDaemonConfig,
  loadConfig,
  syncConfigToDaemon,
} from '../../src/state/config';
import {
  daemonIsLive,
  fetchAgents,
  fetchAppVersionInfo,
  fetchDesignSystems,
  fetchDesignTemplates,
  fetchPromptTemplates,
  fetchSkills,
} from '../../src/providers/registry';
import { listProjects, listTemplates } from '../../src/state/projects';
import type { AppConfig } from '../../src/types';

vi.mock('../../src/router', () => ({
  navigate: vi.fn(),
  useRoute: () => ({ kind: 'home' as const, view: 'home' as const }),
}));

vi.mock('../../src/components/EntryView', () => ({
  EntryView: ({ config }: { config: AppConfig }) => (
    <section>
      <output data-testid="agent-id">{config.agentId ?? 'none'}</output>
      <output data-testid="onboarding-completed">
        {String(config.onboardingCompleted)}
      </output>
    </section>
  ),
}));

vi.mock('../../src/components/ProjectView', () => ({
  ProjectView: () => <div>Project view</div>,
}));

vi.mock('../../src/components/pet/PetOverlay', () => ({
  PetOverlay: () => null,
}));

vi.mock('../../src/components/pet/pets', () => ({
  migrateCustomPetAtlas: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../src/components/SettingsDialog', () => ({
  SettingsDialog: () => null,
}));

vi.mock('../../src/providers/registry', async () => {
  const actual = await vi.importActual<typeof import('../../src/providers/registry')>(
    '../../src/providers/registry',
  );
  return {
    ...actual,
    daemonIsLive: vi.fn(),
    fetchAgents: vi.fn(),
    fetchAppVersionInfo: vi.fn(),
    fetchDesignSystems: vi.fn(),
    fetchDesignTemplates: vi.fn(),
    fetchPromptTemplates: vi.fn(),
    fetchSkills: vi.fn(),
  };
});

vi.mock('../../src/state/projects', async () => {
  const actual = await vi.importActual<typeof import('../../src/state/projects')>(
    '../../src/state/projects',
  );
  return {
    ...actual,
    listProjects: vi.fn(),
    listTemplates: vi.fn(),
  };
});

vi.mock('../../src/state/config', async () => {
  const actual = await vi.importActual<typeof import('../../src/state/config')>(
    '../../src/state/config',
  );
  return {
    ...actual,
    fetchComposioConfigFromDaemon: vi.fn().mockResolvedValue(null),
    fetchDaemonConfig: vi.fn(),
    fetchMediaProvidersFromDaemon: vi.fn().mockResolvedValue({
      providers: null,
      status: 'ok',
    }),
    loadConfig: vi.fn(),
    mergeDaemonConfig: vi.fn(actual.mergeDaemonConfig),
    saveConfig: vi.fn(),
    syncComposioConfigToDaemon: vi.fn().mockResolvedValue(true),
    syncConfigToDaemon: vi.fn().mockResolvedValue(undefined),
    syncMediaProvidersToDaemon: vi.fn().mockResolvedValue(undefined),
  };
});

const mockedDaemonIsLive = vi.mocked(daemonIsLive);
const mockedFetchAgents = vi.mocked(fetchAgents);
const mockedFetchAppVersionInfo = vi.mocked(fetchAppVersionInfo);
const mockedFetchDesignSystems = vi.mocked(fetchDesignSystems);
const mockedFetchDesignTemplates = vi.mocked(fetchDesignTemplates);
const mockedFetchPromptTemplates = vi.mocked(fetchPromptTemplates);
const mockedFetchSkills = vi.mocked(fetchSkills);
const mockedFetchDaemonConfig = vi.mocked(fetchDaemonConfig);
const mockedLoadConfig = vi.mocked(loadConfig);
const mockedListProjects = vi.mocked(listProjects);
const mockedListTemplates = vi.mocked(listTemplates);
const mockedSyncConfigToDaemon = vi.mocked(syncConfigToDaemon);

const claudeAgent = {
  id: 'claude',
  name: 'Claude Code',
  bin: 'claude',
  available: true,
  version: '1.0.0',
  models: [{ id: 'sonnet', label: 'Sonnet' }],
};

function appConfig(onboardingCompleted: boolean): AppConfig {
  return {
    mode: 'daemon',
    apiKey: '',
    apiProtocol: 'anthropic',
    apiProtocolConfigs: {},
    apiProviderBaseUrl: 'https://api.anthropic.com',
    apiVersion: '',
    agentCliEnv: {},
    agentId: null,
    agentModels: {},
    baseUrl: 'https://api.anthropic.com',
    composio: {},
    designSystemId: null,
    mediaProviders: {},
    model: 'claude-sonnet-4-5',
    onboardingCompleted,
    privacyDecisionAt: 1,
    skillId: null,
  };
}

describe('App first-run agent auto-select', () => {
  beforeEach(() => {
    mockedDaemonIsLive.mockResolvedValue(true);
    mockedFetchAgents.mockResolvedValue([claudeAgent]);
    mockedFetchAppVersionInfo.mockResolvedValue(null);
    mockedFetchDesignSystems.mockResolvedValue([]);
    mockedFetchDesignTemplates.mockResolvedValue([]);
    mockedFetchPromptTemplates.mockResolvedValue([]);
    mockedFetchSkills.mockResolvedValue([]);
    mockedFetchDaemonConfig.mockResolvedValue({});
    mockedListProjects.mockResolvedValue([]);
    mockedListTemplates.mockResolvedValue([]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({}),
        ok: true,
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('does not auto-pick an agent while first-run onboarding is still in progress', async () => {
    mockedLoadConfig.mockReturnValue(appConfig(false));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-completed').textContent).toBe('false');
      expect(mockedFetchAgents).toHaveBeenCalled();
      expect(mockedFetchDaemonConfig).toHaveBeenCalled();
    });
    await new Promise((resolve) => window.setTimeout(resolve, 50));

    expect(screen.getByTestId('agent-id').textContent).toBe('none');
    expect(
      mockedSyncConfigToDaemon.mock.calls.some(
        ([config]) => (config as AppConfig | undefined)?.agentId === 'claude',
      ),
    ).toBe(false);
  });

  it('still backfills the first available agent after onboarding has completed', async () => {
    mockedLoadConfig.mockReturnValue(appConfig(true));
    mockedFetchDaemonConfig.mockResolvedValue({ onboardingCompleted: true });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('agent-id').textContent).toBe('claude');
    });
  });
});
