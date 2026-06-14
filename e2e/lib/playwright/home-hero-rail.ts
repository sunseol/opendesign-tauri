import { expect, type Page } from '@playwright/test';

import { routeAgents } from './mock-factory.js';

const STORAGE_KEY = 'open-design:config';
const OPEN_SETTINGS_LABEL = /Open settings|打开设置|開啟設定/i;

const HOME_CONFIG = {
  mode: 'daemon',
  apiKey: '',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-sonnet-4-5',
  agentId: 'codex',
  skillId: null,
  designSystemId: null,
  onboardingCompleted: true,
  agentModels: { codex: { model: 'default', reasoning: 'default' } },
  privacyDecisionAt: 1,
  telemetry: { metrics: false, content: false, artifactManifest: false },
} as const;

const DESIGN_SYSTEMS = [
  {
    id: 'refly',
    title: 'Refly',
    category: 'Product',
    summary: 'Quiet product system for AI workspaces.',
    swatches: ['#111827', '#f8fafc'],
  },
] as const;

const PROMPT_TEMPLATES = [
  {
    id: 'image-product',
    surface: 'image',
    title: 'Image product concept',
    summary: 'A polished product image prompt.',
    category: 'product',
    model: 'gpt-image-2',
    aspect: '16:9',
    source: { repo: 'open-design/image-prompts', license: 'MIT' },
  },
  {
    id: 'video-reveal',
    surface: 'video',
    title: 'Video reveal',
    summary: 'A short reveal video prompt.',
    category: 'product',
    model: 'doubao-seedance-2-0-260128',
    aspect: '16:9',
    source: { repo: 'open-design/video-prompts', license: 'MIT' },
  },
  {
    id: 'hyperframes-caption',
    surface: 'video',
    title: 'HyperFrames captions',
    summary: 'A caption-led HyperFrames prompt.',
    category: 'motion',
    model: 'hyperframes-html',
    aspect: '16:9',
    source: { repo: 'heygen-com/hyperframes', license: 'MIT' },
  },
] as const;

const HOME_PLUGINS = [
  pluginRecord({
    id: 'example-web-prototype',
    title: 'Web Prototype',
    query:
      'Build a {{fidelity}} {{artifactKind}} for {{audience}} using {{designSystem}} from {{template}}.',
    inputs: [
      { name: 'artifactKind', type: 'string', default: 'web prototype', label: 'Artifact kind' },
      { name: 'fidelity', type: 'select', options: ['wireframe', 'high-fidelity'], default: 'high-fidelity', label: 'Fidelity' },
      { name: 'audience', type: 'string', default: 'product evaluators', label: 'Audience' },
      { name: 'designSystem', type: 'string', default: 'the active project design system', label: 'Design system' },
      { name: 'template', type: 'string', default: 'the bundled web prototype seed', label: 'Template' },
    ],
  }),
  pluginRecord({
    id: 'example-simple-deck',
    title: 'Simple Deck',
    query:
      'Create a {{deckType}} for {{audience}} about {{topic}} with {{slideCount}}. Speaker notes: {{speakerNotes}}. Use {{designSystem}}.',
    inputs: [
      { name: 'deckType', type: 'select', options: ['pitch deck', 'product overview'], default: 'pitch deck', label: 'Deck type' },
      { name: 'topic', type: 'string', default: 'quarterly review', label: 'Topic' },
      { name: 'audience', type: 'string', default: 'decision makers', label: 'Audience' },
      { name: 'slideCount', type: 'select', options: ['5-10 pages', '10-15 pages'], default: '10-15 pages', label: 'Pages' },
      { name: 'speakerNotes', type: 'select', options: ['include speaker notes', 'no speaker notes'], default: 'include speaker notes', label: 'Speaker notes' },
      { name: 'designSystem', type: 'string', default: 'the active project design system', label: 'Design system' },
    ],
  }),
  pluginRecord({
    id: 'od-media-generation',
    title: 'Media generation',
    query: 'Create media.',
    inputs: [],
  }),
] as const;

type PluginRecordOptions = {
  readonly id: string;
  readonly inputs: readonly Record<string, unknown>[];
  readonly query: string;
  readonly title: string;
};

function pluginRecord(options: PluginRecordOptions): Record<string, unknown> {
  return {
    id: options.id,
    title: options.title,
    version: '0.1.0',
    trust: 'bundled',
    sourceKind: 'bundled',
    source: `/tmp/${options.id}`,
    fsPath: `/tmp/${options.id}`,
    capabilitiesGranted: ['prompt:inject'],
    installedAt: 0,
    updatedAt: 0,
    manifest: {
      name: options.id,
      title: options.title,
      version: '0.1.0',
      description: `${options.title} starter.`,
      od: {
        kind: 'scenario',
        taskKind: 'new-generation',
        useCase: { query: options.query },
        inputs: options.inputs,
      },
    },
  };
}

export async function routeHomeHeroRailMocks(page: Page): Promise<void> {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: HOME_CONFIG });

  await page.route('**/api/github/open-design', async (route) => {
    await route.fulfill({ json: { stargazers_count: 51_600 } });
  });
  await page.route('https://api.github.com/repos/nexu-io/open-design', async (route) => {
    await route.fulfill({ json: { stargazers_count: 51_600 } });
  });
  await routeAgents(page, [
    { id: 'codex', name: 'Codex CLI', bin: 'codex', available: true, version: '0.130.0', models: [{ id: 'default', label: 'Default' }] },
  ]);
  await page.route('**/api/app-config', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({ json: { config: HOME_CONFIG } });
  });
  await page.route('**/api/projects', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { projects: [] } });
      return;
    }
    await route.continue();
  });
  await page.route('**/api/design-systems', async (route) => {
    await route.fulfill({ json: { designSystems: DESIGN_SYSTEMS } });
  });
  await page.route('**/api/prompt-templates', async (route) => {
    await route.fulfill({ json: { promptTemplates: PROMPT_TEMPLATES } });
  });
  await page.route('**/api/plugins', async (route) => {
    await route.fulfill({ json: { plugins: HOME_PLUGINS } });
  });
  await page.route('**/api/mcp/servers', async (route) => {
    await route.fulfill({ json: { servers: [], templates: [] } });
  });
  await page.route('**/api/plugins/*/apply', async (route) => {
    const url = new URL(route.request().url());
    const pluginId = url.pathname.split('/')[3] ?? 'unknown';
    await route.fulfill({
      json: {
        query: null,
        contextItems: [],
        inputs: [],
        assets: [],
        mcpServers: [],
        trust: 'trusted',
        capabilitiesGranted: ['prompt:inject'],
        capabilitiesRequired: ['prompt:inject'],
        appliedPlugin: { snapshotId: `snap-${pluginId}`, pluginId, pluginVersion: '0.1.0' },
        projectMetadata: {},
      },
    });
  });
}

export async function gotoEntryHome(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Loading Open Design…')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: OPEN_SETTINGS_LABEL })).toBeVisible();
  await expect(page.getByTestId('home-hero')).toBeVisible();
}

export async function pickRailChip(page: Page, chipId: string): Promise<void> {
  const chip = page.getByTestId(`home-hero-rail-${chipId}`);
  await expect(chip).toBeEnabled();
  await chip.click();
  await expect(page.getByTestId('home-hero-active-type-chip')).toBeVisible();
}

export async function clearActiveChip(page: Page): Promise<void> {
  await page.getByTestId('home-hero-active-type-chip').click();
  await expect(page.getByTestId('home-hero-active-type-chip')).toHaveCount(0);
  await expect(page.getByTestId('home-hero-type-tabs')).toBeVisible();
}
