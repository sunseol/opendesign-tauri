import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveSystemLocale } from '../../src/i18n';
import { en } from '../../src/i18n/locales/en';
import { id } from '../../src/i18n/locales/id';
import { zhCN } from '../../src/i18n/locales/zh-CN';
import { zhTW } from '../../src/i18n/locales/zh-TW';
import { LOCALES, LOCALE_LABEL, type Dict, type Locale } from '../../src/i18n/types';

const EXPECTED_LOCALES = ['en', 'id', 'de', 'zh-CN', 'zh-TW', 'pt-BR', 'es-ES', 'ru', 'fa', 'ar', 'ja', 'ko', 'pl', 'hu', 'fr', 'uk', 'tr', 'th', 'it'];
const ZH_CN_ALLOWED_ENGLISH_KEYS: ReadonlySet<keyof Dict> = new Set([
  'app.brand',
  'avatar.anthropicApi',
  'connectors.category.cms',
  'connectors.category.crm',
  'connectors.category.erp',
  'connectors.category.itsm',
  'designFiles.kindPdf',
  'ds.specToggle',
  'examples.modeOrbit',
  'fileViewer.cloudflareDomainPrefixPlaceholder',
  'fileViewer.cloudflarePagesDevLinkLabel',
  'fileViewer.cloudflarePagesProvider',
  'fileViewer.deploySuccessToastDetails',
  'fileViewer.pdfMeta',
  'fileViewer.vercelProvider',
  'homeHero.chip.hyperframes',
  'newsletter.placeholder',
  'pasteDialog.namePlaceholder',
  'pluginsHome.facet.figma',
  'pluginsHome.facet.framer',
  'pluginsHome.facet.github',
  'pluginsHome.facet.githubGist',
  'pluginsHome.facet.githubPr',
  'pluginsHome.facet.pdf',
  'pluginsHome.facet.pptx',
  'pluginsHome.facet.url',
  'pluginsHome.facet.webflow',
  'settings.amrCloud',
  'settings.anthropicApi',
  'settings.apiSection',
  'settings.azureBaseUrlPlaceholder',
  'settings.designSystemsSourceGithub',
  'settings.libraryInstallGithub',
  'settings.libraryInstallPath',
  'settings.libraryInstallUrl',
  'settings.memoryEmptyHintEn',
  'settings.memoryEmptyHintZh',
  'settings.memoryExtractionKindLlm',
  'settings.modeApiMeta',
  'settings.onboardingSourceGithub',
  'settings.onboardingSourceProductHunt',
  'settings.onboardingSourceYoutube',
  'settings.orbit.title',
  'tasks.primitive.orbit.title',
  'tool.bash',
  'tool.glob',
  'tool.grep',
  'useEverywhere.section.cli.tab',
  'useEverywhere.section.http.tab',
]);
const ZH_TW_REQUIRED_TRANSLATED_KEYS: ReadonlyArray<keyof Dict> = [
  'agentPicker.byok',
  'chat.amrError.authMessage',
  'chat.amrError.authorizeCta',
  'chat.amrError.balanceMessage',
  'chat.amrError.rechargeCta',
  'chat.resumeRunCta',
  'entry.githubStarLabel',
  'pluginsHome.featured',
  'pluginsHome.title',
  'settings.amrCancelSignIn',
  'settings.amrLoginErrorCompact',
  'settings.amrSignInToContinue',
  'settings.amrSigningIn',
  'settings.baseUrl',
  'settings.cliEnvClaudeApiKey',
  'settings.cliEnvClaudeBaseUrl',
  'settings.cliEnvCodexApiKey',
  'settings.cliEnvCodexBaseUrl',
  'settings.cliEnvCodexHome',
  'settings.designSystemsGithubUrl',
  'settings.mcpTitle',
  'settings.mediaProviderApiKey',
  'settings.mediaProviderBaseUrl',
  'settings.onboardingAmrCloudBenefitModels',
  'settings.onboardingAmrCloudBenefitOfficial',
  'settings.onboardingAmrCloudBenefitPricing',
  'settings.onboardingAmrCloudBenefitReady',
  'settings.onboardingAmrCloudUpcomingImageVideo',
  'settings.onboardingAmrCloudUpcomingLabel',
  'settings.onboardingAmrCloudUpcomingRouting',
  'settings.onboardingAmrCloudUpcomingSkills',
];

function placeholders(value: string): string[] {
  const names: string[] = [];
  for (const match of value.matchAll(/\{(\w+)\}/g)) {
    if (match[1]) {
      names.push(match[1]);
    }
  }
  return names.sort();
}

async function loadDict(locale: Locale): Promise<Dict> {
  const module = await import(`../../src/i18n/locales/${locale}.ts`);
  const dict = Object.values(module).find((value): value is Dict => {
    return Boolean(value) && typeof value === 'object';
  });
  if (!dict) {
    throw new Error(`No dictionary export found for locale ${locale}`);
  }
  return dict;
}

function explicitLocaleKeys(locale: Locale): string[] {
  const source = readFileSync(new URL(`../../src/i18n/locales/${locale}.ts`, import.meta.url), 'utf8');
  return Array.from(source.matchAll(/'([^']+)':/g), (match) => match[1] ?? '').filter(Boolean);
}

describe('i18n locales', () => {
  it('resolves the initial locale from browser language preferences', () => {
    expect(resolveSystemLocale(['zh-Hans-CN', 'en-US'])).toBe('zh-CN');
    expect(resolveSystemLocale(['zh-Hant-HK', 'en-US'])).toBe('zh-TW');
    expect(resolveSystemLocale(['pt-PT', 'en-US'])).toBe('pt-BR');
    expect(resolveSystemLocale(['es-MX', 'en-US'])).toBe('es-ES');
    expect(resolveSystemLocale(['nl-NL', 'en-US'])).toBe('en');
    expect(resolveSystemLocale(['nl-NL'])).toBeNull();
  });

  it('registers every supported locale in the language menu', () => {
    expect(LOCALES).toEqual(EXPECTED_LOCALES);
    expect((LOCALE_LABEL as Record<string, string>).id).toBe('Bahasa Indonesia');
    expect((LOCALE_LABEL as Record<string, string>).de).toBe('Deutsch');
    expect((LOCALE_LABEL as Record<string, string>).it).toBe('Italiano');
    expect((LOCALE_LABEL as Record<string, string>).ja).toBe('日本語');
  });

  it('keeps locale dictionaries aligned with English keys and placeholders', async () => {
    const englishKeys = Object.keys(en).sort();

    for (const locale of LOCALES) {
      const dict = await loadDict(locale);
      expect(Object.keys(dict).sort()).toEqual(englishKeys);

      for (const key of englishKeys) {
        const dictKey = key as keyof Dict;
        expect(placeholders(dict[dictKey]), `${locale}.${key}`).toEqual(
          placeholders(en[dictKey]),
        );
      }
    }
  });

  it('keeps Indonesian connector settings copy translated instead of falling back to English', () => {
    const translatedKeys: Array<keyof Dict> = [
      'settings.connectorsNavHint',
      'settings.connectorsHint',
      'settings.connectorsComposioApiKey',
      'settings.connectorsSavedTitle',
      'settings.connectorsSaved',
      'settings.connectorsGetApiKey',
      'settings.connectorsApiKeyPlaceholder',
      'settings.connectorsClear',
      'settings.connectorsSaveKey',
      'settings.connectorsKeyError',
      'settings.connectorsHelpEmpty',
      'settings.connectorsLoadingSavedKey',
      'settings.autosaveSaving',
      'settings.autosaveSaved',
      'settings.autosaveError',
      'settings.orbit.eyebrow',
      'settings.orbit.navHint',
      'settings.orbit.lede',
      'settings.orbit.statusOnTitle',
      'settings.orbit.statusOffTitle',
      'settings.orbit.runTitle',
      'settings.orbit.running',
      'settings.orbit.runOpen',
      'settings.orbit.dailySummaryTitle',
      'settings.orbit.dailySummarySub',
      'settings.orbit.runTimeTitle',
      'settings.orbit.runTimeSub',
      'settings.orbit.nextRun',
      'settings.orbit.nextRunScheduledAfterSave',
      'settings.orbit.schedule',
      'settings.orbit.pausedManualOnly',
      'settings.orbit.templateTitle',
      'settings.orbit.templateMissing',
      'settings.orbit.templateMissingOption',
      'settings.orbit.templateMissingInstall',
      'settings.orbit.templateMissingPickAnother',
      'settings.orbit.templateResetTitle',
      'settings.orbit.templateReset',
      'settings.orbit.templateHelp',
      'settings.orbit.templatesLoading',
      'settings.orbit.templatesOptgroup',
      'settings.orbit.lastRun',
      'settings.orbit.countChecked',
      'settings.orbit.countSucceeded',
      'settings.orbit.countSkipped',
      'settings.orbit.countFailed',
      'settings.orbit.runError',
      'settings.orbit.artifactKickerLive',
    ];

    for (const key of translatedKeys) {
      expect(id[key], key).not.toBe(en[key]);
    }
  });

  it('keeps Chinese integrations copy translated instead of falling back to English', () => {
    const translatedKeys: Array<keyof Dict> = [
      'entry.navIntegrations',
      'integrations.kicker',
      'integrations.lede',
      'integrations.agentReady',
      'integrations.tabLabel.mcp',
      'integrations.tabLabel.skills',
      'integrations.tabHint.mcp',
      'integrations.tabHint.connectors',
      'integrations.tabHint.useEverywhere',
      'integrations.skillsTitle',
      'integrations.skillsBody',
      'mcpClient.title',
      'mcpClient.subtitle',
      'mcpClient.addServer',
      'mcpClient.emptyTitle',
      'mcpClient.emptyBody',
      'mcpClient.saveChanges',
      'mcpClient.storedAt',
      'mcpClient.daemonError',
      'mcpClient.saveFailed',
      'tasks.comingSoon',
    ];

    for (const key of translatedKeys) {
      expect(zhCN[key], `zh-CN.${key}`).not.toBe(en[key]);
      expect(zhTW[key], `zh-TW.${key}`).not.toBe(en[key]);
    }
  });

  it('declares CI-sensitive Indonesian fallback keys explicitly', () => {
    const explicitKeys = new Set(explicitLocaleKeys('id'));
    const requiredExplicitKeys = Object.keys(en).filter((key) => {
      return key.startsWith('connectors.category.') || key.startsWith('liveArtifact.viewer.');
    });

    expect(requiredExplicitKeys.filter((key) => !explicitKeys.has(key))).toEqual([]);
  });

  it('avoids brittle per-key English lookups in the Indonesian locale source', () => {
    const source = readFileSync(new URL('../../src/i18n/locales/id.ts', import.meta.url), 'utf8');

    expect(source).not.toMatch(/en\['(?:connectors\.category\.|liveArtifact\.viewer\.)/);
  });

  it('keeps zh-CN explicitly translated for every English key', () => {
    const englishKeys = Object.keys(en).sort();
    const explicit = explicitLocaleKeys('zh-CN').sort();

    expect(
      explicit,
      'zh-CN must explicitly declare every English key instead of relying on fallback spread.',
    ).toEqual(englishKeys);
  });

  it('keeps the zh-CN locale source free of the `...en` spread fallback', () => {
    const source = readFileSync(new URL('../../src/i18n/locales/zh-CN.ts', import.meta.url), 'utf8');

    expect(
      source,
      'zh-CN.ts must not use `...en`; add Chinese values directly when new keys are introduced.',
    ).not.toMatch(/\.\.\.en\b/);
  });

  it('keeps zh-CN user-facing copy translated outside brand, acronym, and placeholder tokens', () => {
    const untranslated: string[] = [];

    for (const key of Object.keys(en) as Array<keyof Dict>) {
      if (
        en[key].length > 0 &&
        zhCN[key] === en[key] &&
        !ZH_CN_ALLOWED_ENGLISH_KEYS.has(key)
      ) {
        untranslated.push(key);
      }
    }

    expect(untranslated).toEqual([]);
  });

  it('keeps zh-TW AMR, settings, plugin, and chat copy translated instead of falling back to English', () => {
    for (const key of ZH_TW_REQUIRED_TRANSLATED_KEYS) {
      expect(zhTW[key], `zh-TW.${key}`).not.toBe(en[key]);
    }
  });
});
