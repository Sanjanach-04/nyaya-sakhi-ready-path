import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { HeartHandshake, ExternalLink, Info } from "lucide-react";
import { api, isBackendStateError, type LegalAidAuthority } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { BackendUnavailableState } from "@/components/backend-state";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/legal-aid")({
  head: () => ({
    meta: [
      { title: "Legal Aid & Support — Nyaya Sakhi" },
      {
        name: "description",
        content: "NALSA, State and District Legal Services Authorities — official contacts only.",
      },
      { property: "og:title", content: "Legal Aid & Support — Nyaya Sakhi" },
      {
        property: "og:description",
        content: "NALSA, State and District Legal Services Authorities — official contacts only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LegalAid,
});

const LEVELS: { value: LegalAidAuthority["level"]; labelKey: "legalAid.national" | "legalAid.state" | "legalAid.district" }[] = [
  { value: "national", labelKey: "legalAid.national" },
  { value: "state", labelKey: "legalAid.state" },
  { value: "district", labelKey: "legalAid.district" },
];

function LegalAid() {
  const { t } = useI18n();
  const [stateFilter, setStateFilter] = useState("all");

  const authorities = useQuery({
    queryKey: ["legal-aid"],
    queryFn: () => api.legalAid.list(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  const backendProblem = authorities.isError && isBackendStateError(authorities.error);
  const all = authorities.data ?? [];
  const states = useMemo(
    () => [...new Set(all.map((a) => a.state).filter((s): s is string => !!s))].sort(),
    [all],
  );

  const filtered = all.filter((a) => stateFilter === "all" || a.level === "national" || a.state === stateFilter);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-3xl bg-secondary/70 p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HeartHandshake className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-4xl">{t("legalAid.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("legalAid.subtitle")}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-border/70 bg-card p-6">
          <h2 className="font-display text-xl">{t("legalAid.freeGuidanceTitle")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("legalAid.freeGuidanceBody")}
          </p>
          <a
            href="https://nalsa.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {t("legalAid.officialLocator")}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>

        <div className="mt-6">
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger aria-label={t("legalAid.allStates")} className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("legalAid.allStates")}</SelectItem>
              {states.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {authorities.isLoading && <p className="mt-8 text-sm text-muted-foreground">{t("common.loading")}</p>}
        {backendProblem && (
          <div className="mt-8">
            <BackendUnavailableState error={authorities.error} />
          </div>
        )}
        {authorities.isError && !backendProblem && (
          <p className="mt-8 text-sm text-destructive">{t("common.errorGeneric")}</p>
        )}

        {authorities.data &&
          LEVELS.map(({ value, labelKey }) => {
            const items = filtered.filter((a) => a.level === value);
            if (items.length === 0) return null;
            return (
              <section key={value} className="mt-8">
                <h2 className="font-display text-2xl">{t(labelKey)}</h2>
                <ul className="mt-3 space-y-3">
                  {items.map((a) => (
                    <li key={a.id} className="rounded-2xl border border-border/70 bg-card p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{a.name}</h3>
                        {a.is_demo && <Badge variant="outline">{t("legalAid.demoBadge")}</Badge>}
                        {a.last_verified_date && (
                          <Badge variant="secondary">
                            {t("legalAid.verified")} {a.last_verified_date}
                          </Badge>
                        )}
                      </div>
                      {a.address && <p className="mt-1 text-sm text-muted-foreground">{a.address}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        {a.phone && (
                          <a href={`tel:${a.phone.replace(/[^0-9+]/g, "")}`} className="font-medium text-primary hover:underline">
                            {a.phone}
                          </a>
                        )}
                        {a.website && (
                          <a
                            href={a.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Website
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        )}
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground/80">Source: {a.source_reference}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

        {authorities.data && filtered.length === 0 && (
          <p className="mt-8 rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-6 text-sm text-muted-foreground">
            {t("legalAid.empty")}
          </p>
        )}

        <p className="mt-10 flex items-start gap-2 rounded-xl bg-secondary/60 p-4 text-xs leading-relaxed text-secondary-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Nyaya Sakhi never invents lawyers, addresses or phone numbers. Every entry here is
          added by administrators from official publications, with its source shown.
        </p>
      </div>
    </AppShell>
  );
}
