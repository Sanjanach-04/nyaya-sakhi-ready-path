import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Scale, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { z } from "zod";
import { ResendConfirmation } from "@/components/resend-confirmation";
import { authErrorMessage, classifyAuthError, safeRedirect, signUpOutcome } from "@/lib/auth-helpers";

const authSearchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  /** Same-origin path to return to after signing in (sanitised by safeRedirect). */
  redirect: z.string().max(2000).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: authSearchSchema,
  head: () => ({
    meta: [
      { title: "Sign in or create an account — Nyaya Sakhi" },
      {
        name: "description",
        content: "Sign in to Nyaya Sakhi to ask legal questions, save your history, draft complaints and more.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);
  /** Shown above the form: unconfirmed email (with resend) or other problems. */
  const [notice, setNotice] = useState<{ kind: "unconfirmed" | "error"; text: string } | null>(null);
  const returnTo = safeRedirect(search.redirect);
  const emailRedirectTo =
    typeof window === "undefined" ? "" : `${window.location.origin}/auth?redirect=${encodeURIComponent(returnTo)}`;

  const goBack = () => navigate({ to: returnTo, replace: true });

  useEffect(() => {
    if (search.mode) setMode(search.mode);
  }, [search.mode]);

  // Already signed in (or just came back from Google / the email link)?
  // Return to the page the user came from.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: returnTo, replace: true });
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: returnTo, replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate, returnTo]);

  const validate = (): string | null => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return "Please enter a valid email address.";
    if (mode !== "forgot" && password.length < 6)
      return "Password must be at least 6 characters.";
    if (mode === "signup" && displayName.trim().length < 2)
      return "Please tell us your name (at least 2 letters).";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (classifyAuthError(error) === "email_not_confirmed") {
            setNotice({ kind: "unconfirmed", text: authErrorMessage(error) });
          } else {
            setNotice({ kind: "error", text: authErrorMessage(error) });
            toast.error(authErrorMessage(error));
          }
          return;
        }
        goBack();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo,
            data: { display_name: displayName.trim() },
          },
        });
        if (error) {
          setNotice({ kind: "error", text: authErrorMessage(error) });
          toast.error(authErrorMessage(error));
          return;
        }
        // Works with "Confirm email" ON (no session yet) or OFF (signed in now).
        const outcome = signUpOutcome(data);
        if (outcome === "signed_in") goBack();
        else if (outcome === "confirm_email") setAwaitingEmailConfirm(true);
        else {
          setMode("signin");
          setNotice({
            kind: "unconfirmed",
            text: "An account with this email already exists. Sign in — or, if you never confirmed it, resend the confirmation email.",
          });
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          toast.error(authErrorMessage(error));
          return;
        }
        toast.success("Password reset link sent. Please check your email.");
        setMode("signin");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOAuth = async (provider: "google" | "lovable") => {
    setBusy(true);
    try {
      // Return to this public page; it forwards to `returnTo` once the session is set.
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: emailRedirectTo,
      });
      if (result.error) toast.error(result.error.message);
      // When redirected to the provider, the browser navigates away — nothing to do.
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "signin"
      ? "Welcome back"
      : mode === "signup"
        ? "Create your account"
        : "Reset your password";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Scale className="h-5 w-5" />
          </span>
          <span className="font-display text-2xl">Nyaya Sakhi</span>
        </Link>

        <div className="rounded-3xl border border-border/70 bg-card p-7 shadow-lg shadow-primary/5 sm:p-9">
          {awaitingEmailConfirm ? (
            <div className="text-center">
              <h1 className="font-display text-3xl">Check your email</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
                Click it to activate your account, then sign in.
              </p>
              <div className="mt-6">
                <ResendConfirmation email={email} emailRedirectTo={emailRedirectTo} startCoolingDown />
              </div>
              <button
                onClick={() => {
                  setAwaitingEmailConfirm(false);
                  setMode("signin");
                }}
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl">{title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "forgot"
                  ? "Enter your email and we'll send you a reset link."
                  : "Know Your Rights. Find Your Support. Take Your Next Step."}
              </p>

              <div className="mt-6 flex gap-2 rounded-full bg-muted p-1">
                {(
                  [
                    ["signin", "Sign in"],
                    ["signup", "Register"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setMode(value);
                      setNotice(null);
                    }}
                    className={`h-9 flex-1 rounded-full text-sm font-medium transition-colors ${
                      mode === value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {notice && (
                <div
                  role="alert"
                  className={`mt-5 space-y-3 rounded-2xl border p-4 text-sm leading-relaxed ${
                    notice.kind === "unconfirmed"
                      ? "border-status-warn/40 bg-status-warn/10 text-foreground"
                      : "border-destructive/40 bg-destructive/10 text-foreground"
                  }`}
                >
                  <p>{notice.text}</p>
                  {notice.kind === "unconfirmed" && (
                    <ResendConfirmation email={email} emailRedirectTo={emailRedirectTo} />
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <div>
                    <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium">
                      Your name
                    </label>
                    <input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Ananya Rao"
                      autoComplete="name"
                      className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                {mode !== "forgot" && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="password" className="text-sm font-medium">
                        Password
                      </label>
                      {mode === "signin" && (
                        <button
                          type="button"
                          onClick={() => setMode("forgot")}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create account"
                      : "Send reset link"}
                </button>
                {mode === "forgot" && (
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                  >
                    Back to sign in
                  </button>
                )}
              </form>

              {mode !== "forgot" && (
                <>
                  <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    or continue with
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleOAuth("google")}
                      disabled={busy}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-input bg-background text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                        <path
                          fill="#EA4335"
                          d="M12 5.3c1.6 0 3 .55 4.1 1.63l3.06-3.06C17.3 2.1 14.87 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.57 2.77C6.6 7.2 9.06 5.3 12 5.3z"
                        />
                        <path
                          fill="#4285F4"
                          d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.57 2.77c2.08-1.92 3.85-4.75 3.85-8.59z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.77 14.13A7.2 7.2 0 0 1 5.39 12c0-.74.13-1.46.36-2.13L2.18 7.1A11.97 11.97 0 0 0 1 12c0 1.94.46 3.77 1.18 4.9l3.59-2.77z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.94 0-5.4-1.9-6.25-4.5l-3.57 2.77C3.99 20.53 7.7 23 12 23z"
                        />
                      </svg>
                      Google
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOAuth("lovable")}
                      disabled={busy}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-input bg-background text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
                    >
                      <Scale className="h-4 w-4 text-primary" />
                      Lovable
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Your questions and history stay private to your account. Nyaya Sakhi provides legal
          information, not legal advice.
        </p>
      </div>
    </div>
  );
}
