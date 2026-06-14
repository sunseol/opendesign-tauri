import type { MouseEvent } from 'react';

type AmrAccountControlStatus =
  | 'signed-out'
  | 'signing-in'
  | 'signed-in'
  | 'signing-out'
  | 'error';

type Props = {
  readonly status: AmrAccountControlStatus;
  readonly className?: string;
  readonly email?: string;
  readonly errorMessage?: string | null;
  readonly signInLabel?: string;
  readonly onSignIn?: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly onSignOut?: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly signInDisabled?: boolean;
  readonly signOutDisabled?: boolean;
};

function classNames(...names: ReadonlyArray<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}

export function AmrAccountControl({
  status,
  className,
  email = '',
  errorMessage,
  signInLabel = 'Authorize',
  onSignIn,
  onSignOut,
  signInDisabled = false,
  signOutDisabled = false,
}: Props) {
  const signedIn = status === 'signed-in';
  const signingIn = status === 'signing-in';
  const signingOut = status === 'signing-out';
  const failed = status === 'error';
  const canSignIn = status === 'signed-out' || failed;
  const statusText = signedIn
    ? email || 'Signed in'
    : signingIn
      ? 'Signing in...'
      : signingOut
        ? 'Signing out...'
        : 'Not signed in';

  return (
    <div
      className={classNames(
        'amr-account-control',
        `amr-account-control--${status}`,
        className,
      )}
      role="group"
      aria-label="AMR account status"
    >
      <span className="amr-account-control__status">
        <span className="amr-account-control__status-text">{statusText}</span>
      </span>
      {signedIn && onSignOut ? (
        <button
          type="button"
          className="amr-account-control__action"
          disabled={signOutDisabled}
          onClick={onSignOut}
          title={email || undefined}
          aria-label="Sign out"
        >
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      ) : null}
      {canSignIn && onSignIn ? (
        <button
          type="button"
          className="amr-account-control__action"
          disabled={signInDisabled}
          onClick={onSignIn}
        >
          {signingIn ? 'Signing in...' : signInLabel}
        </button>
      ) : null}
      {failed ? (
        <span className="amr-account-control__error" role="alert">
          {errorMessage || 'AMR sign-in failed.'}
        </span>
      ) : null}
    </div>
  );
}
