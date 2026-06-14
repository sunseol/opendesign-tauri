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
const ZH_TW_WORKSPACE_TAB_KEYS: ReadonlyArray<keyof Dict> = [
  'workspaceTabs.marketplace',
  'workspaceTabs.pluginDetails',
  'workspaceTabs.project',
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
const ZH_TW_TASKS_SAMPLE_KEYS: ReadonlyArray<keyof Dict> = [
  'tasks.sample.candidate.artifactMeta',
  'tasks.sample.candidate.body1',
  'tasks.sample.candidate.body2',
  'tasks.sample.candidate.body3',
  'tasks.sample.candidate.meta',
  'tasks.sample.candidate.output',
  'tasks.sample.candidate.pattern',
  'tasks.sample.candidate.preview',
  'tasks.sample.candidate.runtime',
  'tasks.sample.candidate.status',
  'tasks.sample.candidate.title',
  'tasks.sample.candidate.trigger',
  'tasks.sample.mcp.artifactMeta',
  'tasks.sample.mcp.body1',
  'tasks.sample.mcp.body2',
  'tasks.sample.mcp.body3',
  'tasks.sample.mcp.body4',
  'tasks.sample.mcp.body5',
  'tasks.sample.mcp.meta',
  'tasks.sample.mcp.output',
  'tasks.sample.mcp.pattern',
  'tasks.sample.mcp.preview',
  'tasks.sample.mcp.runtime',
  'tasks.sample.mcp.status',
  'tasks.sample.mcp.title',
  'tasks.sample.mcp.trigger',
  'tasks.sample.meeting.artifactMeta',
  'tasks.sample.meeting.body1',
  'tasks.sample.meeting.body2',
  'tasks.sample.meeting.body3',
  'tasks.sample.meeting.meta',
  'tasks.sample.meeting.output',
  'tasks.sample.meeting.pattern',
  'tasks.sample.meeting.preview',
  'tasks.sample.meeting.runtime',
  'tasks.sample.meeting.status',
  'tasks.sample.meeting.title',
  'tasks.sample.meeting.trigger',
  'tasks.sample.orbit.artifactMetaDisabled',
  'tasks.sample.orbit.artifactMetaEnabled',
  'tasks.sample.orbit.body1',
  'tasks.sample.orbit.body2',
  'tasks.sample.orbit.body3',
  'tasks.sample.orbit.metaDisabled',
  'tasks.sample.orbit.metaEnabled',
  'tasks.sample.orbit.output',
  'tasks.sample.orbit.pattern',
  'tasks.sample.orbit.previewDisabled',
  'tasks.sample.orbit.previewEnabled',
  'tasks.sample.orbit.runtime',
  'tasks.sample.orbit.title',
  'tasks.sample.orbit.triggerDisabled',
  'tasks.sample.orbit.triggerEnabled',
  'tasks.sample.pr.artifactMeta',
  'tasks.sample.pr.body1',
  'tasks.sample.pr.body2',
  'tasks.sample.pr.body3',
  'tasks.sample.pr.meta',
  'tasks.sample.pr.output',
  'tasks.sample.pr.pattern',
  'tasks.sample.pr.preview',
  'tasks.sample.pr.runtime',
  'tasks.sample.pr.status',
  'tasks.sample.pr.title',
  'tasks.sample.pr.trigger',
  'tasks.sample.weekly.artifactMeta',
  'tasks.sample.weekly.body1',
  'tasks.sample.weekly.body2',
  'tasks.sample.weekly.body3',
  'tasks.sample.weekly.body4',
  'tasks.sample.weekly.body5',
  'tasks.sample.weekly.meta',
  'tasks.sample.weekly.output',
  'tasks.sample.weekly.pattern',
  'tasks.sample.weekly.preview',
  'tasks.sample.weekly.runtime',
  'tasks.sample.weekly.status',
  'tasks.sample.weekly.title',
  'tasks.sample.weekly.trigger',
];

describe('zh-TW fallback parity', () => {
  it('keeps workspace tabs translated instead of falling back to English', () => {
    for (const key of ZH_TW_WORKSPACE_TAB_KEYS) {
      expect(zhTW[key], `zh-TW.${key}`).not.toBe(en[key]);
    }
  });

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

  it('keeps automation sample card copy translated instead of falling back to English', () => {
    for (const key of ZH_TW_TASKS_SAMPLE_KEYS) {
      expect(zhTW[key], `zh-TW.${key}`).not.toBe(en[key]);
    }
  });
});
