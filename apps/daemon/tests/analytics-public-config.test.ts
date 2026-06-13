import { describe, expect, it } from 'vitest';

import { applyAppConfigToPublicConfigResponse } from '../src/analytics.js';

describe('analytics public config', () => {
  it('keeps key and host available while product analytics are opted out', () => {
    const result = applyAppConfigToPublicConfigResponse(
      {
        enabled: true,
        env: 'production',
        key: 'ph_project',
        host: 'https://posthog.example',
      },
      {
        installationId: 'install-123',
        telemetry: { metrics: false },
      },
    );

    expect(result).toEqual({
      enabled: false,
      env: 'production',
      key: 'ph_project',
      host: 'https://posthog.example',
      installationId: 'install-123',
    });
  });

  it('enables product analytics only when metrics consent is true', () => {
    const result = applyAppConfigToPublicConfigResponse(
      {
        enabled: true,
        env: 'staging',
        key: 'ph_project',
        host: 'https://posthog.example',
      },
      { telemetry: { metrics: true } },
    );

    expect(result).toEqual({
      enabled: true,
      env: 'staging',
      key: 'ph_project',
      host: 'https://posthog.example',
      installationId: null,
    });
  });

  it('leaves keyless environments fully disabled', () => {
    const result = applyAppConfigToPublicConfigResponse(
      {
        enabled: false,
        env: 'development',
        key: null,
        host: null,
      },
      { telemetry: { metrics: true } },
    );

    expect(result).toEqual({
      enabled: false,
      env: 'development',
      key: null,
      host: null,
    });
  });
});
