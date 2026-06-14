import { beforeEach, describe, expect, it } from 'vitest';

import {
  deliverableSlideNavForActiveFile,
  isSlideNavDeliverableNow,
  resetConsumedSlideNavForTests,
  shouldConsumeSlideNav,
} from '../../src/runtime/slide-nav';

describe('shouldConsumeSlideNav', () => {
  beforeEach(() => resetConsumedSlideNavForTests());

  it('consumes a request only once for a preview key', () => {
    const key = 'project-1:deck.html';

    expect(shouldConsumeSlideNav(key, 5)).toBe(true);
    expect(shouldConsumeSlideNav(key, 5)).toBe(false);
    expect(shouldConsumeSlideNav(key, 5)).toBe(false);
  });

  it('allows a fresh nonce for the same preview key', () => {
    const key = 'project-1:deck.html';

    expect(shouldConsumeSlideNav(key, 5)).toBe(true);
    expect(shouldConsumeSlideNav(key, 9)).toBe(true);
    expect(shouldConsumeSlideNav(key, 9)).toBe(false);
  });

  it('tracks preview keys independently', () => {
    expect(shouldConsumeSlideNav('project-1:a.html', 5)).toBe(true);
    expect(shouldConsumeSlideNav('project-1:b.html', 5)).toBe(true);
    expect(shouldConsumeSlideNav('project-1:a.html', 5)).toBe(false);
    expect(shouldConsumeSlideNav('project-1:b.html', 5)).toBe(false);
  });
});

describe('slide nav deliverability', () => {
  it('is deliverable only when the target deck is already open', () => {
    expect(isSlideNavDeliverableNow({ name: 'deck.html' }, ['deck.html', 'index.html'])).toBe(true);
    expect(isSlideNavDeliverableNow({ name: 'deck.html' }, ['index.html'])).toBe(false);
    expect(isSlideNavDeliverableNow({ name: '' }, ['deck.html'])).toBe(false);
    expect(isSlideNavDeliverableNow(null, ['deck.html'])).toBe(false);
  });

  it('forwards a deliverable request to the active file', () => {
    const request = { name: 'deck.html', slideIndex: 3, nonce: 7 };

    expect(deliverableSlideNavForActiveFile(request, 'deck.html', 7)).toEqual({
      slideIndex: 3,
      nonce: 7,
    });
  });

  it('does not forward a request for a deck opened after the send started', () => {
    const request = { name: 'deck.html', slideIndex: 3, nonce: 7 };

    expect(deliverableSlideNavForActiveFile(request, 'deck.html', null)).toBeNull();
    expect(deliverableSlideNavForActiveFile(request, 'other.html', 7)).toBeNull();
  });
});
