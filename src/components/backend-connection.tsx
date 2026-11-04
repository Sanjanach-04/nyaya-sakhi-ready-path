import * as React from "react";
import { useHydrated } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n/en";
import { useMyRoles } from "@/hooks/use-my-roles";
import {
  getApiBaseOverride,
  getEnvApiBaseUrl,
  isDevOrPreviewBuild,
  setApiBaseOverride,
  validateBackendUrl,
} from "@/lib/backend-config";
import { backendHealthQuery, type BackendDiagnosis } from "@/lib/backend-health";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function useBackendHealth() {
  return useQuery(backendHealthQuery());
}

/** Re-run the health check and every page query (the "Try again" action). */
export function useRetryBackend() {
  const queryClient = useQueryClient();
  return React.useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);
}

/** Only admins, or development/preview builds, may see the connection dialog. */
export function useCanConfigureBackend(): boolean {
  const hydrated = useHydrated();
  const { data: me } = useMyRoles();
  if (!hydrated) return false;
  return isDevOrPreviewBuild() || !!me?.isAdmin;
}

export type ConnectionTone = "ok" | "warn" | "error" | "checking";

export function connectionTone(diag: BackendDiagnosis | undefined): ConnectionTone {
  if (!diag) return "checking";
  if (diag.state === "ok") return "ok";
  if (diag.state === "unhealthy") return "warn";
  return "error";
}

const TONE_LABEL: Record<ConnectionTone, TranslationKey> = {
  ok: "conn.statusOk",
  warn: "conn.statusDegraded",
  error: "conn.statusDown",
  checking: "conn.statusChecking",
};

const TONE_DOT: Record<ConnectionTone, string> = {
  ok: "bg-status-ok",
  warn: "bg-status-warn",
  error: "bg-status-error",
  checking: "bg-muted-foreground/50 animate-pulse",
};

export function ConnectionDot({ tone, className = "" }: { tone: ConnectionTone; className?: string }) {
  return <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[tone]} ${className}`} />;
}

export function ConnectionStatusLabel() {
  const { t } = useI18n();
  const health = useBackendHealth();
  const tone = health.isFetching && !health.data ? "checking" : connectionTone(health.data);
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <ConnectionDot tone={tone} />
      <span>{t(TONE_LABEL[tone])}</span>
    </span>
  );
}

export function BackendConnectionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const retry = useRetryBackend();
  const envUrl = getEnvApiBaseUrl();
  const [value, setValue] = React.useState("");
  const [invalid, setInvalid] = React.useState(false);
  const [hasOverride, setHasOverride] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const current = getApiBaseOverride();
    setValue(current);
    setHasOverride(!!current);
    setInvalid(false);
  }, [open]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateBackendUrl(value);
    if (!result.ok) {
      setInvalid(true);
      return;
    }
    setApiBaseOverride(result.url);
    onOpenChange(false);
    retry();
  };

  const clear = () => {
    setApiBaseOverride(null);
    onOpenChange(false);
    retry();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("conn.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("conn.dialogDesc")}</DialogDescription>
        </DialogHeader>

        {envUrl ? (
          <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
            {t("conn.dialogEnvSet")} <code className="break-all font-mono text-foreground">{envUrl}</code>
          </p>
        ) : (
          <form id="backend-connection-form" onSubmit={save} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="backend-url">{t("conn.dialogUrlLabel")}</Label>
              <Input
                id="backend-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://nyaya-sakhi-api.onrender.com"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setInvalid(false);
                }}
                aria-invalid={invalid}
                aria-describedby={invalid ? "backend-url-error" : undefined}
              />
              {invalid && (
                <p id="backend-url-error" className="text-xs text-destructive">
                  {t("conn.dialogInvalid")}
                </p>
              )}
            </div>
            <div
              role="note"
              className="flex gap-2.5 rounded-xl border border-status-warn/50 bg-status-warn/10 px-3.5 py-3 text-xs leading-relaxed text-foreground"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warn" aria-hidden />
              <span>{t("conn.dialogWarning")}</span>
            </div>
          </form>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {!envUrl && hasOverride && (
            <Button type="button" variant="ghost" onClick={clear}>
              {t("conn.dialogClear")}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {!envUrl && (
            <Button type="submit" form="backend-connection-form">
              {t("conn.dialogSave")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
