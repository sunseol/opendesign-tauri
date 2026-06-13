import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

export function isImeComposing(
  _event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  composing: boolean,
): boolean {
  return composing;
}
