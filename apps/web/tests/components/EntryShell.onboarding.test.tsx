// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EntryShell } from '../../src/components/EntryShell';
import { I18nProvider } from '../../src/i18n';
import type { AgentInfo, AppConfig } from '../../src/types';

const analyticsMocks = vi.hoisted(() => ({
  track: vi.fn(),
}));

vi.mock('../../src/analytics/provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/analytics/provider')>();
  return {
    ...actual,
    useAnalytics: () => ({
      anonymousId: 'anon-test',
      sessionId: 'session-test',
      newRequestId: vi.fn(() => 'request-1'),
      setConfigureGlobals: vi.fn(),
      setConsent: vi.fn(),
      setIdentity: vi.fn(),
      setUserId: vi.fn(),
      track: analyticsMocks.track,
    }),
    useAppVersion: () => '0.0.0-test',
  };
});

function amrAgent(overrides: Partial<AgentInfo> = {}): AgentInfo {
  return {
    id: 'amr',
    name: 'AMR',
    bin: 'vela',
    available: true,
    models: [{ id: 'amr-model', label: 'AMR Model' }],
    ...overrides,
  };
}

function cliAgent(overrides: Partial<AgentInfo> = {}): AgentInfo {
  return {
    id: 'claude',
    name: 'Claude Code',
    bin: 'claude',
    available: true,
    version: '1.0.0',
    models: [{ id: 'sonnet', label: 'Sonnet' }],
    ...overrides,
  };
}

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    mode: 'daemon',
    apiKey: '',
    baseUrl: '',
    model: '',
    apiProtocol: 'anthropic',
    apiProtocolConfigs: {},
    agentId: null,
    skillId: null,
    designSystemId: null,
    agentModels: {},
    ...overrides,
  };
}

function renderOnboarding(
  overrides: Partial<ComponentProps<typeof EntryShell>> = {},
) {
  window.history.replaceState(null, '', '/onboarding');
  const props: ComponentProps<typeof EntryShell> = {
    skills: [],
    designTemplates: [],
    designSystems: [],
    projects: [],
    templates: [],
    promptTemplates: [],
    defaultDesignSystemId: null,
    connectors: [],
    connectorsLoading: false,
    config: baseConfig(),
    agents: [amrAgent(), cliAgent()],
    daemonLive: true,
    onModeChange: vi.fn(),
    onAgentChange: vi.fn(),
    onAgentModelChange: vi.fn(),
    onApiProtocolChange: vi.fn(),
    onApiModelChange: vi.fn(),
    onConfigPersist: vi.fn(),
    onRefreshAgents: vi.fn(() => [amrAgent(), cliAgent()]),
    onThemeChange: vi.fn(),
    onCreateProject: vi.fn(),
    onCreatePluginShareProject: vi.fn(),
    onImportClaudeDesign: vi.fn(),
    onOpenProject: vi.fn(),
    onOpenLiveArtifact: vi.fn(),
    onDeleteProject: vi.fn(),
    onRenameProject: vi.fn(),
    onChangeDefaultDesignSystem: vi.fn(),
    onPersistComposioKey: vi.fn(),
    onOpenSettings: vi.fn(),
    onCompleteOnboarding: vi.fn(),
    ...overrides,
  };

  render(
    <I18nProvider initial="en">
      <EntryShell {...props} />
    </I18nProvider>,
  );

  return props;
}

afterEach(() => {
  cleanup();
  analyticsMocks.track.mockReset();
});

describe('EntryShell onboarding AMR detection', () => {
  it('shows the AMR cloud card as a skeleton while agent detection is still in flight', () => {
    renderOnboarding({
      agents: [cliAgent()],
      agentsLoading: true,
      onRefreshAgents: vi.fn(() => [cliAgent()]),
    });

    const skeleton = document.querySelector('.onboarding-view__card--skeleton');
    expect(skeleton).toBeTruthy();
    expect(skeleton?.textContent).toContain('Open Design AMR');
    expect(skeleton?.getAttribute('aria-busy')).toBe('true');
    expect(skeleton?.querySelectorAll('.onboarding-view__skeleton-line--benefit').length).toBe(4);
    expect(skeleton?.querySelector('.onboarding-view__skeleton-model-bar')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Open Design AMR/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Local coding agent/i })).toBeTruthy();
  });

  it('renders the real AMR cloud card and no skeleton once AMR is available', () => {
    renderOnboarding({ agentsLoading: false });

    expect(screen.getByRole('button', { name: /Open Design AMR/i })).toBeTruthy();
    expect(document.querySelector('.onboarding-view__card--skeleton')).toBeNull();
  });
});
