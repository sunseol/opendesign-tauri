import { describe, expect, it } from 'vitest';

import {
  amrRechargeUrlForProfile,
  resolveRunFailureUi,
} from '../../src/runtime/amr-guidance';

describe('AMR run failure guidance', () => {
  it('maps AMR auth and balance failures to account actions', () => {
    expect(resolveRunFailureUi('AMR_AUTH_REQUIRED', 'amr')).toMatchObject({
      primaryAction: 'authorize',
      messageKey: 'chat.amrError.authMessage',
      secondaryRetry: false,
    });
    expect(resolveRunFailureUi('AMR_INSUFFICIENT_BALANCE', 'amr')).toMatchObject({
      primaryAction: 'recharge',
      messageKey: 'chat.amrError.balanceMessage',
      secondaryRetry: true,
    });
  });

  it('keeps generic failures on retry', () => {
    expect(resolveRunFailureUi('AGENT_EXECUTION_FAILED', 'amr')).toEqual({
      primaryAction: 'retry',
      messageKey: null,
      secondaryRetry: false,
    });
    expect(resolveRunFailureUi('AMR_AUTH_REQUIRED', 'claude')).toEqual({
      primaryAction: 'retry',
      messageKey: null,
      secondaryRetry: false,
    });
  });

  it('adds Open Design source attribution to wallet links', () => {
    expect(amrRechargeUrlForProfile(null)).toBe(
      'https://open-design.ai/amr/wallet?source=open_design',
    );
    expect(amrRechargeUrlForProfile('test')).toBe(
      'https://vela.powerformer.net/wallet?source=open_design',
    );
    expect(amrRechargeUrlForProfile('local')).toBe(
      'http://localhost:5173/wallet?source=open_design',
    );
  });
});
