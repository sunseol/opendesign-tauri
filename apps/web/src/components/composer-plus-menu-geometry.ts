import type { CSSProperties } from 'react';

const MENU_MARGIN = 12;
const MENU_GAP = 8;
const MENU_WIDTH = 190;
const FLYOUT_WIDTH = 320;
const MIN_HEIGHT = 180;
const FLYOUT_MAX_HEIGHT = 360;
const FLYOUT_MIN_HEIGHT = 120;
const FLYOUT_OFFSET = 5;

export type FlyoutSide = 'right' | 'left' | 'contained';
export type FlyoutY = 'down' | 'up';

export interface FlyoutGeometry {
  readonly y: FlyoutY;
  readonly maxHeight: number;
}

export const DEFAULT_FLYOUT_GEOMETRY: FlyoutGeometry = {
  y: 'down',
  maxHeight: FLYOUT_MAX_HEIGHT,
};

export function composerPlusMenuStyle(anchor: HTMLElement): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || MENU_WIDTH;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 640;
  const width = Math.min(MENU_WIDTH, Math.max(0, viewportWidth - MENU_MARGIN * 2));
  const left = Math.min(
    Math.max(MENU_MARGIN, rect.left),
    Math.max(MENU_MARGIN, viewportWidth - MENU_MARGIN - width),
  );
  const spaceAbove = rect.top - MENU_MARGIN - MENU_GAP;
  const spaceBelow = viewportHeight - rect.bottom - MENU_MARGIN - MENU_GAP;

  if (spaceAbove >= MIN_HEIGHT || spaceAbove >= spaceBelow) {
    return {
      left,
      top: 'auto',
      bottom: Math.max(MENU_MARGIN, viewportHeight - rect.top + MENU_GAP),
      width,
      maxHeight: Math.max(0, spaceAbove),
    };
  }

  return {
    left,
    top: Math.max(MENU_MARGIN, rect.bottom + MENU_GAP),
    bottom: 'auto',
    width,
    maxHeight: Math.max(0, spaceBelow),
  };
}

export function composerPlusFlyoutSide(anchor: HTMLElement): FlyoutSide {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
  const width = Math.min(MENU_WIDTH, Math.max(0, viewportWidth - MENU_MARGIN * 2));
  const menuLeft = Math.min(
    Math.max(MENU_MARGIN, rect.left),
    Math.max(MENU_MARGIN, viewportWidth - MENU_MARGIN - width),
  );
  const boundary = flyoutBoundary(anchor);
  const rightSpace = boundary.right - (menuLeft + width + MENU_GAP);
  const leftSpace = menuLeft - MENU_GAP - boundary.left;
  if (rightSpace >= FLYOUT_WIDTH) return 'right';
  if (leftSpace >= FLYOUT_WIDTH) return 'left';
  return 'contained';
}

export function composerPlusFlyoutGeometry(row: HTMLElement | null): FlyoutGeometry {
  if (!row) return DEFAULT_FLYOUT_GEOMETRY;

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 640;
  const rowRect = row.getBoundingClientRect();
  const downSpace = viewportHeight - (rowRect.top - FLYOUT_OFFSET) - MENU_MARGIN;
  const upSpace = rowRect.bottom + FLYOUT_OFFSET - MENU_MARGIN;
  const nextY = downSpace >= FLYOUT_MAX_HEIGHT || downSpace >= upSpace ? 'down' : 'up';
  const nextSpace = nextY === 'up' ? upSpace : downSpace;

  return {
    y: nextY,
    maxHeight: Math.max(FLYOUT_MIN_HEIGHT, Math.min(FLYOUT_MAX_HEIGHT, nextSpace)),
  };
}

function flyoutBoundary(anchor: HTMLElement): Pick<DOMRect, 'left' | 'right'> {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
  const viewport = { left: MENU_MARGIN, right: viewportWidth - MENU_MARGIN };
  const boundary = anchor.closest('.split-chat-slot, .pane');
  if (!boundary) return viewport;
  const rect = boundary.getBoundingClientRect();
  if (!Number.isFinite(rect.left) || !Number.isFinite(rect.right) || rect.right <= rect.left) {
    return viewport;
  }
  return {
    left: Math.max(MENU_MARGIN, rect.left),
    right: Math.min(viewportWidth - MENU_MARGIN, rect.right),
  };
}
