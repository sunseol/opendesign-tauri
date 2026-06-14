import { describe, expect, it } from 'vitest';

import { en } from '../../src/i18n/locales/en';
import { zhTW } from '../../src/i18n/locales/zh-TW';
import type { Dict } from '../../src/i18n/types';

const ZH_TW_PROJECT_OVERVIEW_KEYS: ReadonlyArray<keyof Dict> = [
  'project.customInstructions',
  'project.customInstructionsPlaceholder',
  'recentProjects.empty',
  'recentProjects.title',
  'recentProjects.viewAll',
];
const ZH_TW_SETTINGS_BYOK_KEYS: ReadonlyArray<keyof Dict> = [
  'settings.advanced',
  'settings.apiKeyGetLink',
  'settings.apiKeyInvalid',
  'settings.azureBaseUrlHint',
  'settings.azureModelFetchHint',
  'settings.customInstructionsHint',
  'settings.customInstructionsPlaceholder',
  'settings.customInstructionsTitle',
  'settings.fetchModels',
  'settings.fetchModelsEmpty',
  'settings.fetchModelsFailed',
  'settings.fetchModelsInvalidBaseUrl',
  'settings.fetchModelsMissingFields',
  'settings.fetchModelsRunning',
  'settings.fetchModelsSuccess',
  'settings.fetchModelsTitle',
  'settings.fetchModelsUnsupported',
  'settings.fetchModelsUnsupportedAzure',
  'settings.fetchModelsUnsupportedOllama',
  'settings.modelsLoadedFromAccount',
];

describe('zh-TW fallback parity', () => {
  it('keeps recent project and project instruction copy translated instead of falling back to English', () => {
    for (const key of ZH_TW_PROJECT_OVERVIEW_KEYS) {
      expect(zhTW[key], `zh-TW.${key}`).not.toBe(en[key]);
    }
  });

  it('keeps BYOK settings and global instruction copy translated instead of falling back to English', () => {
    for (const key of ZH_TW_SETTINGS_BYOK_KEYS) {
      expect(zhTW[key], `zh-TW.${key}`).not.toBe(en[key]);
    }
  });
});
