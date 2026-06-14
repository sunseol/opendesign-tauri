// Lightweight transient toast for the new project-actions toolbar
// (Continue in CLI / Finalize design package — #451). Mirrors the
// canonical state-based pattern from PromptTemplatePreviewModal:
// transient state cleared on a setTimeout, no portal, no DOM
// imperative work. Single-toast queue; multi-toast support is
// deliberately deferred to a follow-up.
//
// Renders an optional secondary `details` line beneath the primary
// message so daemon error envelopes that carry an upstream
// explanation (e.g. Anthropic account-usage-cap reasons) can surface
// the real upstream message alongside the daemon's category label.

import { useEffect, useState } from 'react';

import { Icon, type IconName } from './Icon';

export interface ToastProps {
  message: string;
  details?: string | null;
  // Optional code/preformatted body. When present the toast pins
  // itself open (no auto-dismiss) so the user has time to manually
  // copy the content. Used for the clipboard-failure recovery path
  // in Continue in CLI: when copyToClipboard returns false the
  // prepared prompt is rendered here so the user can select-and-copy
  // it manually.
  code?: string | null;
  ttlMs?: number;
  onDismiss?: () => void;
  /** ARIA role. Use "alert" for error messages (announced immediately),
   *  "status" (default) for non-urgent confirmations. */
  role?: 'status' | 'alert';
  tone?: 'default' | 'success' | 'error' | 'loading';
  placement?: 'bottom' | 'top';
}

const DEFAULT_TTL = 4000;
const EXIT_MS = 160;

type ToastTone = NonNullable<ToastProps['tone']>;

const TONE_ICON: Record<ToastTone, IconName | null> = {
  default: null,
  success: 'check',
  error: 'close',
  loading: 'spinner',
};

export function Toast({
  message,
  details,
  code,
  ttlMs = DEFAULT_TTL,
  onDismiss,
  role = 'status',
  tone = 'default',
  placement = 'bottom',
}: ToastProps) {
  // When code is present the toast is a manual-action surface; never
  // auto-dismiss it out from under the user mid-copy.
  const effectiveTtl = code ? 0 : ttlMs;
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setLeaving(false);
    if (!onDismiss || !Number.isFinite(effectiveTtl) || effectiveTtl <= 0) return;
    const fadeAt = Math.max(0, effectiveTtl - EXIT_MS);
    const fadeId = window.setTimeout(() => setLeaving(true), fadeAt);
    const dismissId = window.setTimeout(() => onDismiss(), effectiveTtl);
    return () => {
      window.clearTimeout(fadeId);
      window.clearTimeout(dismissId);
    };
  }, [message, details, code, effectiveTtl, onDismiss]);

  const iconName = TONE_ICON[tone];

  return (
    <div
      className={`od-toast tone-${tone} placement-${placement}${leaving ? ' leaving' : ''}`}
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
    >
      <div className="od-toast-body">
        {iconName ? (
          <span className="od-toast-icon" aria-hidden>
            <Icon name={iconName} size={14} />
          </span>
        ) : null}
        <div className="od-toast-message">{message}</div>
      </div>
      {details ? <div className="od-toast-details">{details}</div> : null}
      {code ? (
        <pre className="od-toast-code">{code}</pre>
      ) : null}
      {code && onDismiss ? (
        <button
          type="button"
          className="od-toast-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
