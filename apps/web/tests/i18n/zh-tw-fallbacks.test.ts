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
const ZH_TW_SETTINGS_TEST_AND_MEMORY_KEYS: ReadonlyArray<keyof Dict> = [
  'settings.memoryExtractionsClearConfirm',
  'settings.memoryModelInlineHintByokNeutral',
  'settings.required',
  'settings.testMissingFields',
  'settings.testRetry',
];
const ZH_TW_TASKS_SURFACE_KEYS: ReadonlyArray<keyof Dict> = [
  'tasks.configurationAria',
  'tasks.filter.done',
  'tasks.filter.running',
  'tasks.filter.scheduled',
  'tasks.filtersAria',
  'tasks.kicker',
  'tasks.lede',
  'tasks.listAria',
  'tasks.liveArtifact',
  'tasks.newAutomation',
  'tasks.openArtifact',
  'tasks.pause',
  'tasks.previewNote',
  'tasks.primitive.liveArtifacts.body',
  'tasks.primitive.liveArtifacts.meta',
  'tasks.primitive.liveArtifacts.title',
  'tasks.primitive.orbit.body',
  'tasks.primitive.orbit.enabled',
  'tasks.primitive.orbit.manualOnly',
  'tasks.primitive.routines.body',
  'tasks.primitive.routines.meta',
  'tasks.primitive.routines.title',
  'tasks.primitive.schedules.body',
  'tasks.primitive.schedules.meta',
  'tasks.primitive.schedules.title',
  'tasks.primitivesAria',
  'tasks.routinesAndRuns',
  'tasks.runNow',
  'tasks.slot.output',
  'tasks.slot.pattern',
  'tasks.slot.runtime',
  'tasks.slot.trigger',
  'tasks.status.dailyAt',
  'tasks.status.pausedManual',
  'tasks.viewProgress',
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

  it('keeps settings test and memory action copy translated instead of falling back to English', () => {
    for (const key of ZH_TW_SETTINGS_TEST_AND_MEMORY_KEYS) {
      expect(zhTW[key], `zh-TW.${key}`).not.toBe(en[key]);
    }
  });

  it('keeps automation task surface copy translated instead of falling back to English', () => {
    for (const key of ZH_TW_TASKS_SURFACE_KEYS) {
      expect(zhTW[key], `zh-TW.${key}`).not.toBe(en[key]);
    }
  });
});
