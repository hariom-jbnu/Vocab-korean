/** Shortest password the sign-up and change-password forms accept. */
export const MIN_PASSWORD = 8;

/** Plain-language text for the errors Supabase Auth returns, by error code. */
const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  email_not_confirmed: 'Confirm your email first: open the link in the email we sent you, then sign in.',
  user_already_exists: 'An account with this email already exists. Sign in instead, or use "Forgot password".',
  email_exists: 'An account with this email already exists. Sign in instead, or use "Forgot password".',
  weak_password: `That password is too easy to guess. Use at least ${MIN_PASSWORD} characters with letters and numbers.`,
  same_password: 'That is already your password. Choose a different one.',
  over_email_send_rate_limit: 'Too many emails were sent. Wait a few minutes and try again.',
  over_request_rate_limit: 'Too many tries. Wait a minute and try again.',
  email_address_invalid: 'That email address does not look right.',
  email_address_not_authorized: 'Emails cannot be sent to this address yet. Try Google sign-in, or ask the app owner to set up email.',
  signup_disabled: 'New accounts are turned off right now.',
  email_provider_disabled: 'Email sign-in is turned off for this app.',
  otp_expired: 'That code or link has expired or was already used. Ask for a new one.',
  reauthentication_needed: 'For safety, sign out and sign in again before changing your password.',
};

const UNREACHABLE = 'Could not reach the server. Check your connection and try again.';

export function authErrorText(e: unknown): string {
  const err = (e && typeof e === 'object' ? e : {}) as { code?: unknown; message?: unknown };
  if (typeof err.code === 'string' && BY_CODE[err.code]) return BY_CODE[err.code];
  const text = typeof err.message === 'string' ? err.message : '';
  if (!text) return 'Something went wrong. Try again.';
  if (/failed to fetch|network|load failed/i.test(text)) return UNREACHABLE;
  // Older servers send no code for these two.
  if (/invalid login credentials/i.test(text)) return BY_CODE.invalid_credentials;
  if (/email not confirmed/i.test(text)) return BY_CODE.email_not_confirmed;
  return text;
}

/** An error with a Supabase-style code, for cases the app detects itself. */
export function authError(code: string, message = BY_CODE[code] ?? code): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}
