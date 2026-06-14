import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { applyStandardMocks } from '@/playwright/mock-factory';

const FILLER_MESSAGE_PAIRS = 12;

test.describe('chat pane autoscroll on TodoCard growth', () => {
  test.describe.configure({ timeout: 45_000 });

  test.beforeEach(async ({ page }) => {
    await applyStandardMocks(page);
  });

  test('[P2] pinned user stays at bottom after PinnedTodoCard grows', async ({ page }) => {
    const ids = await seedProjectWithTodos(page, 'pinned');
    await gotoSeededConversation(page, ids);

    const distanceAfterLoad = await bottomDistance(page);
    expect(distanceAfterLoad, `distance=${distanceAfterLoad}`).toBeLessThan(20);
    await expectScrollable(page);
    await expect(page.locator('.chat-pinned-todo')).toBeVisible({ timeout: 5_000 });

    const beforeHeight = await chatLogClientHeight(page);
    await growPinnedTodo(page, 80);

    const afterHeight = await chatLogClientHeight(page);
    expect(afterHeight, `before=${beforeHeight} after=${afterHeight}`).toBeLessThan(beforeHeight);
    const distanceAfterGrow = await bottomDistance(page);
    expect(distanceAfterGrow, `distance=${distanceAfterGrow}`).toBeLessThan(20);
  });

  test('[P2] user scroll-up is preserved when PinnedTodoCard grows', async ({ page }) => {
    const ids = await seedProjectWithTodos(page, 'scrolled');
    await gotoSeededConversation(page, ids);

    await expect(page.locator('.chat-pinned-todo')).toBeVisible({ timeout: 5_000 });
    await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.chat-log');
      if (!el) throw new Error('No .chat-log element found');
      el.scrollTop = Math.max(0, el.scrollTop - 150);
      el.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await page.waitForTimeout(50);

    const distanceAfterScroll = await bottomDistance(page);
    expect(distanceAfterScroll, `distance=${distanceAfterScroll}`).toBeGreaterThan(80);
    const scrollTopBeforeGrow = await chatLogScrollTop(page);
    const heightBeforeGrow = await chatLogClientHeight(page);

    await growPinnedTodo(page, 80);

    const heightAfterGrow = await chatLogClientHeight(page);
    expect(heightAfterGrow, `before=${heightBeforeGrow} after=${heightAfterGrow}`).toBeLessThan(heightBeforeGrow);
    const scrollTopAfterGrow = await chatLogScrollTop(page);
    expect(Math.abs(scrollTopAfterGrow - scrollTopBeforeGrow)).toBeLessThan(20);
  });
});

type ConversationIds = {
  readonly projectId: string;
  readonly conversationId: string;
};

async function seedProjectWithTodos(page: Page, suffix: string): Promise<ConversationIds> {
  const projectId = `todo-scroll-${suffix}-${randomUUID()}`;
  const createResponse = await page.request.post('/api/projects', {
    data: {
      id: projectId,
      name: `Todo Scroll ${suffix}`,
      skillId: null,
      designSystemId: null,
      pendingPrompt: null,
      metadata: { kind: 'prototype' },
    },
  });
  expect(createResponse.ok(), await createResponse.text()).toBeTruthy();
  const createBody: unknown = await createResponse.json();
  if (!isConversationCreateBody(createBody)) {
    throw new Error(`unexpected create response for ${projectId}`);
  }
  const ids = { projectId, conversationId: createBody.conversationId };

  for (let i = 0; i < FILLER_MESSAGE_PAIRS; i += 1) {
    await putMessage(page, ids, `u-fill-${i}`, {
      role: 'user',
      content: `Filler question ${i + 1}: what is step ${i + 1}?`,
      createdAt: Date.now() - (FILLER_MESSAGE_PAIRS - i + 2) * 1_000,
    });
    await putMessage(page, ids, `a-fill-${i}`, {
      role: 'assistant',
      content: `Filler answer ${i + 1}: step ${i + 1} involves doing the work carefully.`,
      runStatus: 'succeeded',
      createdAt: Date.now() - (FILLER_MESSAGE_PAIRS - i + 1) * 1_000,
    });
  }

  await putMessage(page, ids, 'u-final', {
    role: 'user',
    content: 'please build something',
    createdAt: Date.now() - 2_000,
  });
  await putMessage(page, ids, 'a-final', {
    role: 'assistant',
    content: 'sure, here is the plan',
    runStatus: 'succeeded',
    events: [
      {
        kind: 'tool_use',
        id: `tw-${projectId}`,
        name: 'TodoWrite',
        input: {
          todos: Array.from({ length: 4 }, (_value, index) => ({
            content: `Task ${index + 1}`,
            status: 'pending',
          })),
        },
      },
    ],
    createdAt: Date.now() - 1_000,
  });

  return ids;
}

async function putMessage(page: Page, ids: ConversationIds, messageId: string, data: Record<string, unknown>) {
  const response = await page.request.put(
    `/api/projects/${ids.projectId}/conversations/${ids.conversationId}/messages/${messageId}-${ids.projectId}`,
    { data },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function gotoSeededConversation(page: Page, ids: ConversationIds): Promise<void> {
  await page.goto(`/projects/${ids.projectId}/conversations/${ids.conversationId}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('.chat-log')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('chat-composer')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.chat-log').getByText('Filler question 1: what is step 1?')).toBeVisible({
    timeout: 10_000,
  });
}

async function expectScrollable(page: Page): Promise<void> {
  const scrollableHeight = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.chat-log');
    return el ? el.scrollHeight - el.clientHeight : -1;
  });
  expect(scrollableHeight, `scrollableHeight=${scrollableHeight}`).toBeGreaterThan(50);
}

async function bottomDistance(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.chat-log');
    return el ? el.scrollHeight - el.scrollTop - el.clientHeight : -1;
  });
}

async function chatLogClientHeight(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelector<HTMLElement>('.chat-log')?.clientHeight ?? -1);
}

async function chatLogScrollTop(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelector<HTMLElement>('.chat-log')?.scrollTop ?? -1);
}

async function growPinnedTodo(page: Page, extraPx: number): Promise<void> {
  await page.evaluate((px) => {
    const logEl = document.querySelector<HTMLElement>('.chat-log');
    const pinnedTodo = document.querySelector<HTMLElement>('.chat-pinned-todo');
    if (!logEl) throw new Error('No .chat-log element found');
    if (!pinnedTodo) throw new Error('No .chat-pinned-todo element found');

    const scrollTopBefore = logEl.scrollTop;
    pinnedTodo.style.minHeight = `${pinnedTodo.offsetHeight + px}px`;
    void logEl.clientHeight;
    logEl.scrollTop = scrollTopBefore;
  }, extraPx);
  await page.waitForTimeout(100);
}

function isConversationCreateBody(value: unknown): value is { readonly conversationId: string } {
  if (typeof value !== 'object' || value === null) return false;
  return 'conversationId' in value && typeof value.conversationId === 'string';
}
