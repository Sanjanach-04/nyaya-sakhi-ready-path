/**
 * Pure helpers for the sign-in / sign-up flow (no React, easy to test).
 */

/** Default page after signing in when no safe return path was given. */
export const DEFAULT_AFTER_LOGIN = "/dashboard";

/** Seconds a user must wait between "Resend confirmation email" clicks. */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Only same-origin app paths are allowed as a post-login return target.
 * Rejects absolute URLs, protocol-relative ("//evil.com"), backslash tricks
 * and the auth page itself (which would loop).
 */
export function safeRedirect(target: unknown): string {
  if (typeof target !== "string" || target.length === 0 || target.length > 2000) {
    return DEFAULT_AFTER_LOGIN;
  }
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN;
  }
  if (/[\u0000-\u001f]/.test(target)) return DEFAULT_AFTER_LOGIN;
  const pathOnly = target.split(/[?#]/)[0] ?? "";
  if (pathOnly === "/auth" || pathOnly.startsWith("/auth/")) return DEFAULT_AFTER_LOGIN;
  return target;
}

export type AuthErrorKind =
  | "email_not_confirmed"
  | "rate_limited"
  | "invalid_credentials"
  | "user_exists"
  | "weak_password"
  | "other";

interface AuthErrorLike {
  message?: string | undefined;
  status?: number | undefined;
  code?: string | undefined;
}

/** Map a sign-in / sign-up / resend error to a kind the UI can explain. */
export function classifyAuthError(error: AuthErrorLike | null | undefined): AuthErrorKind {
  if (!error) return "other";
  const code = (error.code ?? "").toLowerCase();
  const msg = (error.message ?? "").toLowerCase();
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "email_not_confirmed";
  }
  if (
    error.status === 429 ||
    code.startsWith("over_") || // over_email_send_rate_limit, over_request_rate_limit, over_sms_send_rate_limit
    msg.includes("rate limit") ||
    msg.includes("too many") ||
    msg.includes("for security purposes, you can only request this")
  ) {
    return "rate_limited";
  }
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "invalid_credentials";
  }
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered")) {
    return "user_exists";
  }
  if (code === "weak_password" || msg.includes("password should")) return "weak_password";
  return "other";
}

export const AUTH_ERROR_MESSAGES: Record<Exclude<AuthErrorKind, "other">, string> = {
  email_not_confirmed:
    "Your email address is not confirmed yet. Open the confirmation link we sent you, or resend it below.",
  rate_limited: "Too many attempts, please wait a few minutes and try again.",
  invalid_credentials: "That email and password don't match. Check them and try again.",
  user_exists: "An account with this email already exists. Please sign in instead.",
  weak_password: "Please choose a stronger password (at least 6 characters, avoid common words).",
};

/** Human message for an auth error. */
export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  const kind = classifyAuthError(error);
  if (kind === "other") return error?.message || "Something went wrong. Please try again.";
  return AUTH_ERROR_MESSAGES[kind];
}

export type SignUpOutcome = "signed_in" | "confirm_email" | "already_registered";

/**
 * What to do after a successful signUp() call.
 * - session returned → confirmation is OFF, go straight in.
 * - no session and the user has no identities → the email was already
 *   registered (Supabase hides this to prevent account enumeration).
 * - otherwise → confirmation is ON: show "Check your email".
 */
export function signUpOutcome(data: {
  session: unknown | null;
  user: { identities?: unknown[] | null } | null;
}): SignUpOutcome {
  if (data.session) return "signed_in";
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return "already_registered";
  }
  return "confirm_email";
}

/** Seconds left on the resend cooldown (0 when ready). */
export function cooldownRemaining(lastSentAt: number | null, now: number): number {
  if (lastSentAt === null) return 0;
  const left = RESEND_COOLDOWN_SECONDS - Math.floor((now - lastSentAt) / 1000);
  return left > 0 ? left : 0;
}
