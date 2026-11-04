import * as React from "react";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, classifyAuthError, cooldownRemaining } from "@/lib/auth-helpers";

/**
 * "Resend confirmation email" button with a 60-second cooldown.
 * `startCoolingDown` starts the timer immediately (right after sign-up, when
 * an email was just sent).
 */
export function ResendConfirmation({
  email,
  emailRedirectTo,
  startCoolingDown = false,
}: {
  email: string;
  emailRedirectTo: string;
  startCoolingDown?: boolean;
}) {
  const [lastSentAt, setLastSentAt] = React.useState<number | null>(
    startCoolingDown ? Date.now() : null,
  );
  const [now, setNow] = React.useState(() => Date.now());
  const [sending, setSending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const remaining = cooldownRemaining(lastSentAt, now);

  React.useEffect(() => {
    if (remaining <= 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [remaining]);

  const resend = async () => {
    if (!email || remaining > 0 || sending) return;
    setSending(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo },
      });
      if (error) {
        const text = authErrorMessage(error);
        setMessage(text);
        toast.error(text);
        // Rate-limited: still start the cooldown so the user doesn't hammer it.
        if (classifyAuthError(error) === "rate_limited") setLastSentAt(Date.now());
        return;
      }
      setLastSentAt(Date.now());
      setNow(Date.now());
      setMessage(`A new confirmation email was sent to ${email}.`);
      toast.success("Confirmation email sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void resend()}
        disabled={!email || remaining > 0 || sending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-input bg-background text-sm font-semibold transition-colors hover:bg-accent disabled:opacity-60"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <MailCheck className="h-4 w-4" aria-hidden />
        )}
        {remaining > 0 ? `Resend confirmation email (${remaining}s)` : "Resend confirmation email"}
      </button>
      {message && (
        <p className="text-center text-xs text-muted-foreground" aria-live="polite">
          {message}
        </p>
      )}
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Can't find it? Check your Spam, Junk or Promotions folder, and search for “Nyaya Sakhi”.
      </p>
    </div>
  );
}
