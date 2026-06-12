import { describe, expect, it } from 'vitest';

import {
  amrAccountFailureDetails,
  classifyAmrAccountFailure,
  DEFAULT_AMR_RECHARGE_URL,
} from '../../src/integrations/vela-errors.js';

describe('classifyAmrAccountFailure', () => {
  it('maps AMR auth signals to relogin guidance', () => {
    const failure = classifyAmrAccountFailure('session expired: sign in again');

    expect(failure).toMatchObject({
      code: 'AMR_AUTH_REQUIRED',
      action: 'relogin',
    });
    expect(failure?.message).toContain('AMR sign-in is required');
  });

  it('maps balance and quota signals to recharge guidance', () => {
    const failure = classifyAmrAccountFailure('quota failed: wallet balance too low');

    expect(failure).toMatchObject({
      code: 'AMR_INSUFFICIENT_BALANCE',
      action: 'recharge',
      actionUrl: DEFAULT_AMR_RECHARGE_URL,
    });
    expect(amrAccountFailureDetails(failure!)).toEqual({
      kind: 'amr_account',
      action: 'recharge',
      actionUrl: DEFAULT_AMR_RECHARGE_URL,
    });
  });

  it('ignores unrelated provider failures', () => {
    expect(classifyAmrAccountFailure('model not found')).toBeNull();
  });
});
