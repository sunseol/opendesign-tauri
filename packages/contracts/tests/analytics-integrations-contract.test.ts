import { describe, expect, it } from 'vitest';
import {
  byokProtocolToTracking,
  type IntegrationsConnectorsTabClickProps,
} from '../src/analytics/events';

describe('integrations analytics contract', () => {
  it('accepts the connectors gate card click element', () => {
    const payload = {
      page_name: 'integrations',
      area: 'connectors_tab',
      element: 'gate_card',
    } satisfies IntegrationsConnectorsTabClickProps;

    expect(payload.element).toBe('gate_card');
  });

  it('maps OpenRouter BYOK protocol analytics separately from OpenAI', () => {
    expect(byokProtocolToTracking('openrouter')).toBe('openrouter');
    expect(byokProtocolToTracking('openai')).toBe('openai');
  });
});
