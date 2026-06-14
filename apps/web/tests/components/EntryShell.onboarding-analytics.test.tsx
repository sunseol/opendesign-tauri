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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function trackedPayloads(eventName: string): Record<string, unknown>[] {
  return analyticsMocks.track.mock.calls.flatMap((call) => {
    const [event, payload] = call;
    return event === eventName && isRecord(payload) ? [payload] : [];
  });
}

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

function cliAgent(): AgentInfo {
  return {
    id: 'claude',
    name: 'Claude Code',
    bin: 'claude',
    available: true,
    version: '1.0.0',
    models: [{ id: 'sonnet', label: 'Sonnet' }],
  };
}

function baseConfig(): AppConfig {
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
  };
}

function renderOnboarding(): ComponentProps<typeof EntryShell> {
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
    agents: [cliAgent()],
    agentsLoading: false,
    daemonLive: true,
    onModeChange: vi.fn(),
    onAgentChange: vi.fn(),
    onAgentModelChange: vi.fn(),
    onApiProtocolChange: vi.fn(),
    onApiModelChange: vi.fn(),
    onConfigPersist: vi.fn(),
    onRefreshAgents: vi.fn(() => [cliAgent()]),
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
  };

  render(
    <I18nProvider initial="en">
      <EntryShell {...props} />
    </I18nProvider>,
  );

  return props;
}

function chooseOption(fieldLabel: string, optionName: RegExp): void {
  const label = screen.getByText(fieldLabel);
  const root = label.closest('.onboarding-view__select-field');
  if (!root) throw new Error(`Missing dropdown for ${fieldLabel}`);
  const trigger = root.querySelector('button');
  if (!(trigger instanceof HTMLButtonElement)) {
    throw new Error(`Missing dropdown trigger for ${fieldLabel}`);
  }
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  analyticsMocks.track.mockReset();
});

describe('EntryShell onboarding analytics', () => {
  it('captures about-you and newsletter consent when finishing quickly', async () => {
    const props = renderOnboarding();
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'About you' })).toBeTruthy();
    });

    chooseOption('Your role', /Product manager/i);
    chooseOption('Organization size', /Small team/i);
    chooseOption('Use case', /Product design/i);
    fireEvent.keyDown(document, { key: 'Escape' });
    chooseOption('Where did you hear about us?', /GitHub/i);

    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Stay in the loop' })).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Newsletter (optional)'), {
      target: { value: 'Fast@Example.COM ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Design system' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /^Finish/i }));

    await waitFor(() => {
      expect(props.onCompleteOnboarding).toHaveBeenCalled();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://open-design.ai/subscribe',
      expect.objectContaining({
        body: JSON.stringify({ email: 'fast@example.com', source: 'client' }),
      }),
    );
    expect(
      trackedPayloads('ui_click').find((payload) => payload.element === 'about_you_submit'),
    ).toMatchObject({
      area: 'about_you',
      role: 'pm',
      organization_size: 'team',
      use_cases: ['product'],
      discovery_source: 'github',
    });
    expect(
      trackedPayloads('ui_click').find((payload) => payload.element === 'newsletter_email'),
    ).toMatchObject({
      action: 'subscribe',
      newsletter_opt_in: true,
    });
    expect(trackedPayloads('onboarding_complete_result')[0]).toMatchObject({
      result: 'completed',
      completion_type: 'completed_without_design_system',
      has_about_you: true,
      role: 'pm',
      organization_size: 'team',
      use_cases: ['product'],
      discovery_source: 'github',
    });
  });
});
