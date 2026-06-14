import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';

import {
  fetchVelaLoginStatus,
  startVelaLogin,
  velaLogout,
  type VelaLoginStatus,
} from '../providers/daemon';
import {
  AMR_LOGIN_POLL_INTERVAL_MS,
  AMR_LOGIN_STATUS_EVENT,
  amrLoginPollOutcome,
  notifyAmrLoginStatusChanged,
} from './amrLoginPolling';
import { AmrAccountControl } from './AmrAccountControl';

type Props = {
  readonly className?: string;
  readonly initialStatus?: VelaLoginStatus | null;
  readonly signInLabel?: string;
  readonly onStatusChange?: (status: VelaLoginStatus | null) => void;
};

type PendingAction = 'login' | 'logout' | null;

export function AmrLoginPill({
  className,
  initialStatus = null,
  signInLabel,
  onStatusChange,
}: Props) {
  const [status, setStatus] = useState<VelaLoginStatus | null>(initialStatus);
  const [pending, setPending] = useState<PendingAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const loginStartedAtRef = useRef<number | null>(null);

  const applyStatus = useCallback((next: VelaLoginStatus | null) => {
    setStatus(next);
    onStatusChange?.(next);
  }, [onStatusChange]);

  const stopPolling = useCallback(() => {
    if (pollRef.current === null) return;
    window.clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const refresh = useCallback(async () => {
    const next = await fetchVelaLoginStatus();
    if (next) applyStatus(next);
    return next;
  }, [applyStatus]);

  const finishLogin = useCallback((next: VelaLoginStatus | null) => {
    stopPolling();
    loginStartedAtRef.current = null;
    setPending(null);
    setErrorMessage(null);
    applyStatus(next);
  }, [applyStatus, stopPolling]);

  const startPolling = useCallback((startedAt: number) => {
    stopPolling();
    loginStartedAtRef.current = startedAt;
    const tick = async () => {
      const next = await refresh();
      const outcome = amrLoginPollOutcome(next, startedAt);
      if (outcome === 'signed-in') {
        finishLogin(next);
        notifyAmrLoginStatusChanged();
        return;
      }
      if (outcome === 'stopped' || outcome === 'timed-out') {
        stopPolling();
        loginStartedAtRef.current = null;
        setPending(null);
        setErrorMessage('AMR sign-in failed.');
      }
    };
    void tick();
    pollRef.current = window.setInterval(() => {
      void tick();
    }, AMR_LOGIN_POLL_INTERVAL_MS);
  }, [finishLogin, refresh, stopPolling]);

  useEffect(() => {
    applyStatus(initialStatus);
    if (initialStatus?.loggedIn) {
      stopPolling();
      loginStartedAtRef.current = null;
      setPending(null);
      setErrorMessage(null);
    }
  }, [applyStatus, initialStatus, stopPolling]);

  useEffect(() => {
    void refresh();
    return () => {
      stopPolling();
    };
  }, [refresh, stopPolling]);

  useEffect(() => {
    const onStatusChange = () => {
      void refresh().then((next) => {
        if (!next) return;
        if (next.loggedIn) {
          finishLogin(next);
          return;
        }
        if (next.loginInFlight && loginStartedAtRef.current !== null) {
          startPolling(loginStartedAtRef.current);
        }
      });
    };
    window.addEventListener(AMR_LOGIN_STATUS_EVENT, onStatusChange);
    return () => window.removeEventListener(AMR_LOGIN_STATUS_EVENT, onStatusChange);
  }, [finishLogin, refresh, startPolling]);

  async function handleLogin(event: MouseEvent<HTMLButtonElement>): Promise<void> {
    event.stopPropagation();
    if (pending === 'login') return;
    const startedAt = Date.now();
    loginStartedAtRef.current = startedAt;
    setErrorMessage(null);
    setPending('login');
    const result = await startVelaLogin(null);
    if (!result.ok && !result.alreadyRunning) {
      loginStartedAtRef.current = null;
      setPending(null);
      setErrorMessage(result.error || 'AMR sign-in failed.');
      return;
    }
    notifyAmrLoginStatusChanged('login-started');
    startPolling(startedAt);
  }

  async function handleLogout(event: MouseEvent<HTMLButtonElement>): Promise<void> {
    event.stopPropagation();
    setErrorMessage(null);
    setPending('logout');
    const result = await velaLogout();
    loginStartedAtRef.current = null;
    stopPolling();
    setPending(null);
    if (!result.ok) {
      setErrorMessage('AMR sign-in failed.');
      return;
    }
    const next = await refresh();
    applyStatus(next ?? {
      loggedIn: false,
      loginInFlight: false,
      profile: 'local',
      user: null,
      configPath: '',
    });
    notifyAmrLoginStatusChanged('status-changed');
  }

  const loggedIn = status?.loggedIn === true;
  const accountStatus = errorMessage
    ? 'error'
    : loggedIn
      ? pending === 'logout'
        ? 'signing-out'
        : 'signed-in'
      : pending === 'login' || status?.loginInFlight === true
        ? 'signing-in'
        : 'signed-out';

  return (
    <div
      className={'amr-login-pill' + (className ? ' ' + className : '')}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <AmrAccountControl
        status={accountStatus}
        email={status?.user?.email ?? ''}
        errorMessage={errorMessage}
        signInLabel={signInLabel}
        signInDisabled={pending === 'login'}
        signOutDisabled={pending === 'logout'}
        onSignIn={(event) => void handleLogin(event)}
        onSignOut={(event) => void handleLogout(event)}
      />
    </div>
  );
}
