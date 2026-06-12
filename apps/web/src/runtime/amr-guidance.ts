export const AMR_CONSOLE_URL =
  'https://open-design.ai/amr/wallet?source=open_design';
export const AMR_RECHARGE_URL = AMR_CONSOLE_URL;

const AMR_CONSOLE_URL_BY_PROFILE: Record<string, string> = {
  prod: AMR_CONSOLE_URL,
  test: 'https://vela.powerformer.net/wallet?source=open_design',
  local: 'http://localhost:5173/wallet?source=open_design',
};

export function amrConsoleUrlForProfile(profile: string | null | undefined): string {
  const normalized = profile?.trim() || 'prod';
  return AMR_CONSOLE_URL_BY_PROFILE[normalized] ?? AMR_CONSOLE_URL;
}

export function amrRechargeUrlForProfile(profile: string | null | undefined): string {
  return amrConsoleUrlForProfile(profile);
}

export type RunFailurePrimaryAction = 'retry' | 'authorize' | 'recharge';

export type RunFailureMessageKey =
  | 'chat.amrError.authMessage'
  | 'chat.amrError.balanceMessage'
  | null;

export interface RunFailureUi {
  primaryAction: RunFailurePrimaryAction;
  messageKey: RunFailureMessageKey;
  secondaryRetry: boolean;
}

export function resolveRunFailureUi(
  code: string | null | undefined,
  agentId: string | null | undefined,
): RunFailureUi {
  if (agentId === 'amr') {
    if (code === 'AMR_AUTH_REQUIRED') {
      return {
        primaryAction: 'authorize',
        messageKey: 'chat.amrError.authMessage',
        secondaryRetry: false,
      };
    }
    if (code === 'AMR_INSUFFICIENT_BALANCE') {
      return {
        primaryAction: 'recharge',
        messageKey: 'chat.amrError.balanceMessage',
        secondaryRetry: true,
      };
    }
  }
  return {
    primaryAction: 'retry',
    messageKey: null,
    secondaryRetry: false,
  };
}
