import { validateBaseUrl } from '@open-design/contracts/api/connectionTest';

import type { ApiProtocol, ProviderModelOption } from '../../types';
import {
  cleanByokApiKey,
  detectByokApiKeyProtocol,
  isGoogleGeminiApiKeyShape,
} from './api-key';
import {
  byokBaseUrlHostname,
  GOOGLE_GEMINI_DEFAULT_BASE_URL,
  normalizeByokBaseUrl,
} from './base-url';

export { cleanByokApiKey } from './api-key';
export { normalizeByokBaseUrl } from './base-url';
export type { NormalizedByokBaseUrl } from './base-url';

export type ByokDraftField = 'api_key' | 'base_url' | 'model';

export type ByokDraftIssueLevel = 'error' | 'warn';

export type ByokDraftIssueCode =
  | 'api_key_required'
  | 'api_key_extra_whitespace'
  | 'api_key_malformed'
  | 'api_key_wrong_protocol'
  | 'base_url_required'
  | 'base_url_invalid'
  | 'model_required';

export type ByokDraftAction =
  | 'focus_api_key'
  | 'focus_base_url'
  | 'focus_model'
  | 'select_provider';

export type ByokDraftIssue = {
  readonly field: ByokDraftField;
  readonly level: ByokDraftIssueLevel;
  readonly code: ByokDraftIssueCode;
  readonly message: string;
  readonly action?: ByokDraftAction;
  readonly detectedProtocol?: ApiProtocol;
};

export type ByokDraftValidation = {
  readonly ok: boolean;
  readonly issues: readonly ByokDraftIssue[];
};

type ValidateByokDraftOptions = {
  readonly requiresApiKey?: boolean;
  readonly requireModel?: boolean;
  readonly keyValidationBaseUrl?: string;
};

type ByokDraftConfig = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
};

export type ByokModelPreferenceSource =
  | 'explicit'
  | 'account'
  | 'provider_default'
  | 'empty';

export type ByokModelPreference = {
  readonly model: string;
  readonly source: ByokModelPreferenceSource;
};

export function validateByokDraft(
  protocol: ApiProtocol,
  config: ByokDraftConfig,
  options: ValidateByokDraftOptions = {},
): ByokDraftValidation {
  const requiresApiKey = options.requiresApiKey ?? true;
  const requireModel = options.requireModel ?? true;
  const issues: ByokDraftIssue[] = [];
  const cleanedApiKey = cleanByokApiKey(config.apiKey);
  const baseUrl = config.baseUrl.trim();
  const model = config.model.trim();

  if (requiresApiKey && !cleanedApiKey) {
    issues.push({
      field: 'api_key',
      level: 'error',
      code: 'api_key_required',
      message: 'API key is required.',
      action: 'focus_api_key',
    });
  } else if (requiresApiKey) {
    if (cleanedApiKey !== config.apiKey) {
      issues.push({
        field: 'api_key',
        level: 'warn',
        code: 'api_key_extra_whitespace',
        message: 'API key contains extra whitespace.',
        action: 'focus_api_key',
      });
    }
    const keyIssue = validateApiKeyShape(
      protocol,
      cleanedApiKey,
      options.keyValidationBaseUrl?.trim() || baseUrl,
    );
    if (keyIssue) issues.push(keyIssue);
  }

  if (!baseUrl) {
    issues.push({
      field: 'base_url',
      level: 'error',
      code: 'base_url_required',
      message: 'Base URL is required.',
      action: 'focus_base_url',
    });
  } else if (validateBaseUrl(baseUrl).error) {
    issues.push({
      field: 'base_url',
      level: 'error',
      code: 'base_url_invalid',
      message: 'Base URL must be a valid public http:// or https:// URL.',
      action: 'focus_base_url',
    });
  } else if (protocol === 'google' && baseUrl) {
    const host = byokBaseUrlHostname(baseUrl);
    if (host === 'api.anthropic.com' || host === 'api.openai.com') {
      issues.push({
        field: 'base_url',
        level: 'error',
        code: 'base_url_invalid',
        message: `Base URL points to ${host}. For Google Gemini use ${GOOGLE_GEMINI_DEFAULT_BASE_URL}.`,
        action: 'focus_base_url',
      });
    }
  }

  if (requireModel && !model) {
    issues.push({
      field: 'model',
      level: 'error',
      code: 'model_required',
      message: 'Model is required.',
      action: 'focus_model',
    });
  }

  return {
    ok: !issues.some((issue) => issue.level === 'error'),
    issues,
  };
}

export function blockingByokDraftIssues(
  validation: ByokDraftValidation,
): ByokDraftIssue[] {
  return validation.issues.filter((issue) => issue.level === 'error');
}

export function blockingByokDraftFields(
  validation: ByokDraftValidation,
): ByokDraftField[] {
  return Array.from(
    new Set(blockingByokDraftIssues(validation).map((issue) => issue.field)),
  );
}

export function resolveByokModelPreference({
  currentModel,
  accountModels,
  providerDefaultModel,
}: {
  readonly currentModel: string;
  readonly accountModels: readonly ProviderModelOption[];
  readonly providerDefaultModel?: string;
}): ByokModelPreference {
  const explicit = currentModel.trim();
  if (explicit) return { model: explicit, source: 'explicit' };
  const account = accountModels.find((model) => model.id.trim());
  if (account) return { model: account.id, source: 'account' };
  const providerDefault = providerDefaultModel?.trim() ?? '';
  if (providerDefault) {
    return { model: providerDefault, source: 'provider_default' };
  }
  return { model: '', source: 'empty' };
}

function validateApiKeyShape(
  protocol: ApiProtocol,
  apiKey: string,
  baseUrl: string,
): ByokDraftIssue | null {
  if (!apiKey) return null;
  const detectedProtocol = detectByokApiKeyProtocol(apiKey);

  if (protocol === 'anthropic' && isAnthropicFirstPartyBaseUrl(baseUrl)) {
    if (apiKey.startsWith('sk-ant-')) return null;
    return {
      field: 'api_key',
      level: 'error',
      code: detectedProtocol === 'openai'
        ? 'api_key_wrong_protocol'
        : 'api_key_malformed',
      message: detectedProtocol === 'openai'
        ? 'This looks like an OpenAI key, not an Anthropic key.'
        : 'This API key does not match the expected Anthropic format.',
      action: 'focus_api_key',
      ...(detectedProtocol ? { detectedProtocol } : {}),
    };
  }

  if (protocol === 'openai' && isOpenAiFirstPartyBaseUrl(baseUrl)) {
    if (apiKey.startsWith('sk-') && !apiKey.startsWith('sk-ant-')) return null;
    return {
      field: 'api_key',
      level: 'error',
      code: detectedProtocol === 'anthropic'
        ? 'api_key_wrong_protocol'
        : 'api_key_malformed',
      message: detectedProtocol === 'anthropic'
        ? 'This looks like an Anthropic key, not an OpenAI-compatible key.'
        : 'This API key does not match the expected OpenAI-compatible format.',
      action: 'focus_api_key',
      ...(detectedProtocol ? { detectedProtocol } : {}),
    };
  }

  if (protocol === 'google' && isGoogleFirstPartyBaseUrl(baseUrl)) {
    if (isGoogleGeminiApiKeyShape(apiKey)) return null;
    return {
      field: 'api_key',
      level: 'error',
      code: detectedProtocol
        ? 'api_key_wrong_protocol'
        : 'api_key_malformed',
      message: detectedProtocol
        ? 'This key does not look like a Google Gemini API key.'
        : 'This API key does not match the expected Google Gemini format.',
      action: 'focus_api_key',
      ...(detectedProtocol ? { detectedProtocol } : {}),
    };
  }

  return null;
}

function isAnthropicFirstPartyBaseUrl(baseUrl: string): boolean {
  return byokBaseUrlHostname(baseUrl) === 'api.anthropic.com';
}

function isOpenAiFirstPartyBaseUrl(baseUrl: string): boolean {
  return byokBaseUrlHostname(baseUrl) === 'api.openai.com';
}

function isGoogleFirstPartyBaseUrl(baseUrl: string): boolean {
  return byokBaseUrlHostname(baseUrl) === 'generativelanguage.googleapis.com';
}
