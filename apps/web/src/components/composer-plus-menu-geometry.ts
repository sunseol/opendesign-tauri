import type { CSSProperties } from 'react';

const MENU_MARGIN = 12;
const MENU_GAP = 8;
const MENU_WIDTH = 190;
const FLYOUT_WIDTH = 320;
const MIN_HEIGHT = 180;

export type FlyoutSide = 'right' | 'left' | 'contained';

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
