import { useI18n } from "@/i18n";
import { ApiError } from "@/lib/api";
import { CloudOff, RefreshCw } from "lucide-react";

/**
 * Full-page state shown when the FastAPI backend is not configured
 * (VITE_API_BASE_URL missing) or unreachable. Never shows fabricated data.
 */
export function BackendUnavailableState({ error }: { error?: unknown }) {
  const { t } = useI18n();
  const kind = error instanceof ApiError ? error.kind : undefined;
  const isUnreachable = kind === "unreachable";

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-border/70 bg-card px-8 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <CloudOff className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-5 font-display text-2xl">{t("backend.notConfiguredTitle")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {t("backend.notConfiguredBody")}
      </p>
      {isUnreachable && (
        <p className="mt-4 rounded-xl bg-muted/60 px-4 py-2 text-xs text-muted-foreground">
          {t("error.backendUnreachable")}
        </p>
      )}
      <p className="mt-4 text-xs text-muted-foreground/80">{t("error.setupHint")}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-full border border-input bg-background px-5 text-sm font-medium transition-colors hover:bg-accent"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        {t("common.retry")}
      </button>
    </div>
  );
}

/** Compact inline variant for small surfaces (banners, side panels). */
export function BackendUnavailableInline() {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-6 text-center text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{t("backend.notConfiguredTitle")}</p>
      <p className="mt-1.5 text-xs leading-relaxed">{t("error.setupHint")}</p>
    </div>
  );
}

