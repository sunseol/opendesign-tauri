// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@open-design/host', async () => {
  const actual = await vi.importActual<typeof import('@open-design/host')>('@open-design/host');
  return {
    ...actual,
    isOpenDesignHostAvailable: vi.fn(() => false),
  };
});

function agent(overrides: Partial<AgentInfo> = {}): AgentInfo {
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

function config(overrides: Partial<AppConfig> = {}): AppConfig {
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

function renderHome(overrides: Partial<ComponentProps<typeof EntryShell>> = {}) {
  window.history.replaceState(null, '', '/');
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
    config: config(),
    agents: [agent()],
    daemonLive: true,
    onModeChange: vi.fn(),
    onAgentChange: vi.fn(),
    onAgentModelChange: vi.fn(),
    onApiProtocolChange: vi.fn(),
    onApiModelChange: vi.fn(),
    onConfigPersist: vi.fn(),
    onRefreshAgents: vi.fn(() => [agent()]),
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  analyticsMocks.track.mockReset();
});

describe('EntryShell Home working directory', () => {
  it('creates Home projects with read-only linkedDirs instead of writeable userWorkingDir', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      if (url === '/api/plugins') {
        return new Response(JSON.stringify({ plugins: [] }), { status: 200 });
      }
      if (url === '/api/mcp/servers') {
        return new Response(JSON.stringify({ servers: [], templates: [] }), {
          status: 200,
        });
      }
      if (url === '/api/recent-dirs') {
        return new Response(JSON.stringify({ dirs: [] }), { status: 200 });
      }
      if (url === '/api/dialog/open-folder' && init?.method === 'POST') {
        return new Response(JSON.stringify({ path: '/Users/me/reference-app' }), {
          status: 200,
        });
      }
      if (url === '/api/app-config' && init?.method === 'PUT') {
        return new Response(JSON.stringify({
          config: { recentLinkedDirs: ['/Users/me/reference-app'] },
        }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${String(url)}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const onCreateProject = vi.fn();

    renderHome({ onCreateProject });

    const input = await screen.findByTestId('home-hero-input');
    fireEvent.change(input, { target: { value: 'Use the reference code' } });
    fireEvent.click(screen.getByTestId('working-dir-trigger'));
    fireEvent.click(await screen.findByTestId('working-dir-pick'));

    await waitFor(() => {
      expect(screen.getByTestId('working-dir-trigger').textContent).toContain('reference-app');
    });
    fireEvent.click(screen.getByTestId('home-hero-submit'));

    await waitFor(() => expect(onCreateProject).toHaveBeenCalledTimes(1));
    const call = onCreateProject.mock.calls[0];
    if (!call) {
      throw new Error('Expected Home submit to create a project');
    }
    const [payload] = call;
    expect(payload.metadata.linkedDirs).toEqual(['/Users/me/reference-app']);
    expect(payload.metadata.userWorkingDir).toBeUndefined();
    expect(payload.userWorkingDirToken).toBeUndefined();
  });
});
