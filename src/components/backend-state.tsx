import * as React from "react";
import { useI18n } from "@/i18n";
import { CheckCircle2, CloudOff, Loader2, PlugZap, RefreshCw, ServerCrash, XCircle } from "lucide-react";
import type { BackendDiagnosis } from "@/lib/backend-health";
import {
  BackendConnectionDialog,
  useBackendHealth,
  useCanConfigureBackend,
  useRetryBackend,
} from "@/components/backend-connection";

/**
 * Full-page state shown when a page cannot load because of the backend.
 * It runs GET /api/health and explains exactly what is wrong:
 *   a) no URL set, b) URL unreachable, c) reachable but parts not ready.
 * Never shows fabricated data.
 */
export function BackendUnavailableState({ error: _error }: { error?: unknown }) {
  const { t } = useI18n();
  const health = useBackendHealth();
  const retry = useRetryBackend();
  const canConfigure = useCanConfigureBackend();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const diag = health.data;
  const checking = health.isFetching;

  const retryButton = (
    <button
      type="button"
      onClick={retry}
      disabled={checking}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-input bg-background px-5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
    >
      <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} aria-hidden />
      {t("common.retry")}
    </button>
  );

  const connectButton =
    canConfigure && diag?.state === "unconfigured" ? (
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <PlugZap className="h-4 w-4" aria-hidden />
        {t("conn.menuItem")}
      </button>
    ) : null;

  return (
    <div
      className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-border/70 bg-card px-6 py-12 text-center sm:px-8"
      aria-live="polite"
    >
      {!diag ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          <p className="mt-4 text-sm text-muted-foreground">{t("conn.checking")}</p>
        </>
      ) : (
        <DiagnosisBody diag={diag} canConfigure={canConfigure} />
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {connectButton}
        {retryButton}
      </div>
      {canConfigure && (
        <BackendConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      )}
    </div>
  );
}

function DiagnosisBody({ diag, canConfigure }: { diag: BackendDiagnosis; canConfigure: boolean }) {
  const { t } = useI18n();

  if (diag.state === "unconfigured") {
    return (
      <>
        <StateIcon><CloudOff className="h-7 w-7" aria-hidden /></StateIcon>
        <h1 className="mt-5 font-display text-2xl">{t("conn.unconfiguredTitle")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("conn.unconfiguredBody")}</p>
        <p className="mt-4 rounded-xl bg-muted/60 px-4 py-3 text-left text-xs leading-relaxed text-muted-foreground">
          {canConfigure ? t("conn.unconfiguredHow") : t("conn.unconfiguredAskAdmin")}
        </p>
      </>
    );
  }

  if (diag.state === "unreachable") {
    return (
      <>
        <StateIcon><ServerCrash className="h-7 w-7" aria-hidden /></StateIcon>
        <h1 className="mt-5 font-display text-2xl">{t("conn.unreachableTitle")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("conn.unreachableBody")}{" "}
          <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{diag.url}</code>
        </p>
        {diag.httpStatus !== undefined && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("conn.httpStatus")} {diag.httpStatus}.
          </p>
        )}
        <div className="mt-5 w-full rounded-xl bg-muted/60 px-4 py-3 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("conn.likelyCauses")}</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>{t("conn.causeNotRunning")}</li>
            <li>
              {t("conn.causeCors")}{" "}
              <code className="break-all font-mono text-foreground">{diag.origin || "this site"}</code>
            </li>
            <li className={diag.mixedContent ? "font-medium text-foreground" : undefined}>{t("conn.causeMixed")}</li>
            <li>{t("conn.causeWrongUrl")}</li>
          </ul>
        </div>
      </>
    );
  }

  if (diag.state === "unhealthy") {
    const parts: { key: "conn.partDb" | "conn.partEmbedding" | "conn.partLlm"; ok: boolean }[] = [
      { key: "conn.partDb", ok: diag.health.db },
      { key: "conn.partEmbedding", ok: diag.health.embedding_model },
      { key: "conn.partLlm", ok: diag.health.llm_configured },
    ];
    return (
      <>
        <StateIcon><ServerCrash className="h-7 w-7" aria-hidden /></StateIcon>
        <h1 className="mt-5 font-display text-2xl">{t("conn.unhealthyTitle")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("conn.unhealthyBody")}{" "}
          <code className="break-all font-mono text-xs text-foreground">{diag.url}</code>
        </p>
        <ul className="mt-5 w-full divide-y divide-border/70 rounded-xl border border-border/70 text-left text-sm">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span>{t(p.key)}</span>
              <span className={`flex items-center gap-1.5 text-xs font-medium ${p.ok ? "text-status-ok" : "text-status-error"}`}>
                {p.ok ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
                {p.ok ? t("conn.ready") : t("conn.notReady")}
              </span>
            </li>
          ))}
        </ul>
      </>
    );
  }

  // Healthy backend, but this page's own request still failed.
  return (
    <>
      <StateIcon><ServerCrash className="h-7 w-7" aria-hidden /></StateIcon>
      <h1 className="mt-5 font-display text-2xl">{t("conn.unreachableTitle")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("conn.okButFailed")}</p>
    </>
  );
}

function StateIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
      {children}
    </span>
  );
}

/** Compact inline variant for small surfaces (banners, side panels). */
export function BackendUnavailableInline() {
  const { t } = useI18n();
  const health = useBackendHealth();
  const retry = useRetryBackend();
  const diag = health.data;
  const title =
    diag?.state === "unhealthy"
      ? t("conn.unhealthyTitle")
      : diag?.state === "unreachable" || diag?.state === "ok"
        ? t("conn.unreachableTitle")
        : t("conn.unconfiguredTitle");
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-6 text-center text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{title}</p>
      {diag?.state === "unreachable" && (
        <p className="mt-1.5 break-all font-mono text-xs">{diag.url}</p>
      )}
      <button
        type="button"
        onClick={retry}
        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full border border-input bg-background px-3.5 text-xs font-medium transition-colors hover:bg-accent"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${health.isFetching ? "animate-spin" : ""}`} aria-hidden />
        {t("common.retry")}
      </button>
    </div>
  );
}
