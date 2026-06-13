// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { smoothScrollToTop } from '../../src/utils/smoothScrollToTop';

type FrameCallback = (now: number) => void;

let frames: Array<{ id: number; cb: FrameCallback }> = [];
let nextFrameId = 1;
let now = 0;

function pumpFrame(deltaMs: number): void {
  now += deltaMs;
  const due = frames;
  frames = [];
  for (const { cb } of due) cb(now);
}

function runAllFrames(maxFrames = 200): void {
  let guard = 0;
  while (frames.length > 0 && guard < maxFrames) {
    pumpFrame(16);
    guard += 1;
  }
}

function makeContainer(scrollTop: number): HTMLElement {
  const el = document.createElement('div');
  el.scrollTop = scrollTop;
  el.scrollLeft = 24;
  return el;
}

function stubMatchMedia(reduced: boolean): void {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: reduced }));
}

beforeEach(() => {
  frames = [];
  nextFrameId = 1;
  now = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameCallback) => {
    const id = nextFrameId;
    nextFrameId += 1;
    frames.push({ id, cb });
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames = frames.filter((frame) => frame.id !== id);
  });
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('smoothScrollToTop', () => {
  it('tweens through intermediate offsets and lands exactly at 0', () => {
    const el = makeContainer(900);
    smoothScrollToTop(el);
    expect(el.scrollLeft).toBe(0);

    pumpFrame(16);
    pumpFrame(100);
    const midway = el.scrollTop;
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(900);

    runAllFrames();
    expect(el.scrollTop).toBe(0);
  });

  it('eases out by covering more distance early than late', () => {
    const el = makeContainer(1200);
    smoothScrollToTop(el);
    pumpFrame(16);

    pumpFrame(100);
    const earlyTravel = 1200 - el.scrollTop;
    const atEarly = el.scrollTop;
    pumpFrame(100);
    const lateTravel = atEarly - el.scrollTop;
    expect(earlyTravel).toBeGreaterThan(lateTravel);
  });

  it('jumps instantly when the user prefers reduced motion', () => {
    stubMatchMedia(true);
    const el = makeContainer(700);
    smoothScrollToTop(el);
    expect(el.scrollTop).toBe(0);
    expect(frames).toHaveLength(0);
  });

  it('stops mid-flight when the user scrolls', () => {
    const el = makeContainer(800);
    smoothScrollToTop(el);
    pumpFrame(16);
    pumpFrame(60);
    const interrupted = el.scrollTop;
    expect(interrupted).toBeGreaterThan(0);

    el.dispatchEvent(new Event('wheel'));
    runAllFrames();
    expect(el.scrollTop).toBe(interrupted);
  });

  it('retargets instead of stacking when invoked twice', () => {
    const el = makeContainer(1000);
    smoothScrollToTop(el);
    pumpFrame(16);
    pumpFrame(60);

    smoothScrollToTop(el);
    expect(frames).toHaveLength(1);
    runAllFrames();
    expect(el.scrollTop).toBe(0);
  });

  it('does nothing when already at the top', () => {
    const el = makeContainer(0);
    smoothScrollToTop(el);
    expect(frames).toHaveLength(0);
    expect(el.scrollTop).toBe(0);
  });
});
