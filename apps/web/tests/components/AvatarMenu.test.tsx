// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AvatarMenu } from '../../src/components/AvatarMenu';
import type { AgentInfo, AppConfig } from '../../src/types';

const baseConfig: AppConfig = {
  mode: 'api',
  apiKey: 'sk-openai-test',
  apiProtocol: 'openai',
  apiVersion: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  apiProviderBaseUrl: 'https://api.openai.com/v1',
  agentId: 'codex',
  skillId: null,
  designSystemId: null,
};

const agents: AgentInfo[] = [
  {
    id: 'codex',
    name: 'Codex',
    bin: 'codex',
    available: true,
    version: '1.0.0',
    models: [{ id: 'default', label: 'Default' }],
  },
];

afterEach(() => cleanup());

describe('AvatarMenu BYOK model selection', () => {
  it('shows provider-specific BYOK models and reports the selected model', () => {
    const onApiModelChange = vi.fn();

    render(
      <AvatarMenu
        config={baseConfig}
        agents={agents}
        daemonLive
        onModeChange={vi.fn()}
        onAgentChange={vi.fn()}
        onAgentModelChange={vi.fn()}
        onApiModelChange={onApiModelChange}
        onOpenSettings={vi.fn()}
        onRefreshAgents={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /account & settings/i }));

    const modelSelect = screen.getByTestId('avatar-byok-model-select') as HTMLSelectElement;
    expect(modelSelect.value).toBe('gpt-4o');
    expect(screen.getByRole('option', { name: 'gpt-4o-mini' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'deepseek-chat' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'MiniMax-M2.7-highspeed' })).toBeNull();

    fireEvent.change(modelSelect, { target: { value: 'gpt-4o-mini' } });

    expect(onApiModelChange).toHaveBeenCalledWith('gpt-4o-mini');
  });
});
