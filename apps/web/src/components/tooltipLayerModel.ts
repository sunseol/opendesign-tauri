export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipStyle {
  readonly x: number;
  readonly y: number;
  readonly visibility: 'hidden' | 'visible';
}

export interface TooltipState {
  readonly target: HTMLElement;
  readonly text: string;
  readonly placement: TooltipPlacement;
  readonly style: TooltipStyle;
}

const TOOLTIP_MARGIN = 8;
const TOOLTIP_GAP = 7;

export function isTooltipTarget(el: Element | null): el is HTMLElement {
  return el instanceof HTMLElement
    && el.classList.contains('od-tooltip')
    && Boolean(el.dataset.tooltip?.trim())
    && el.getAttribute('aria-expanded') !== 'true';
}

export function readTooltipTarget(start: EventTarget | null): HTMLElement | null {
  if (!(start instanceof Element)) return null;
  const candidate = start.closest('.od-tooltip[data-tooltip]');
  return isTooltipTarget(candidate) ? candidate : null;
}

export function tooltipPlacement(target: HTMLElement): TooltipPlacement {
  const raw = target.dataset.tooltipPlacement;
  return raw === 'bottom' || raw === 'left' || raw === 'right' ? raw : 'top';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function positionTooltip(
  target: HTMLElement,
  tooltip: HTMLElement,
  placement: TooltipPlacement,
): TooltipStyle {
  const rect = target.getBoundingClientRect();
  const tip = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = Math.max(TOOLTIP_MARGIN, viewportWidth - tip.width - TOOLTIP_MARGIN);
  const maxTop = Math.max(TOOLTIP_MARGIN, viewportHeight - tip.height - TOOLTIP_MARGIN);

  let left = rect.left + rect.width / 2 - tip.width / 2;
  let top = rect.top - tip.height - TOOLTIP_GAP;

  if (placement === 'bottom') {
    top = rect.bottom + TOOLTIP_GAP;
  } else if (placement === 'left') {
    left = rect.left - tip.width - TOOLTIP_GAP;
    top = rect.top + rect.height / 2 - tip.height / 2;
  } else if (placement === 'right') {
    left = rect.right + TOOLTIP_GAP;
    top = rect.top + rect.height / 2 - tip.height / 2;
  }

  return {
    x: Math.round(clamp(left, TOOLTIP_MARGIN, maxLeft)),
    y: Math.round(clamp(top, TOOLTIP_MARGIN, maxTop)),
    visibility: 'visible',
  };
}

export function sameTooltipStyle(left: TooltipStyle, right: TooltipStyle): boolean {
  return left.x === right.x
    && left.y === right.y
    && left.visibility === right.visibility;
}
