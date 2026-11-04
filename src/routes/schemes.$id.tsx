import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookmarkPlus, Check, ExternalLink, CalendarDays, Building2, Users } from "lucide-react";
import { api, isBackendStateError } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { BackendUnavailableState } from "@/components/backend-state";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/schemes/$id")({
  head: () => ({
    meta: [
      { title: "Scheme details — Nyaya Sakhi" },
      {
        name: "description",
        content: "Eligibility, benefits, documents and the application process for a government scheme.",
      },
      { property: "og:title", content: "Scheme details — Nyaya Sakhi" },
      {
        property: "og:description",
        content: "Eligibility, benefits, documents and the application process for a government scheme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SchemeDetail,
});

function SchemeDetail() {
  const { t } = useI18n();
  const { id } = Route.useParams();
  const [saved, setSaved] = useState(false);

  const scheme = useQuery({
    queryKey: ["scheme", id],
    queryFn: () => api.schemes.get(id),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  const save = useMutation({
    mutationFn: () =>
      api.saved.create({ item_type: "scheme", ref_id: id, title: scheme.data?.name ?? "Scheme" }),
    onSuccess: () => {
      setSaved(true);
      toast.success(t("common.saved"));
    },
    onError: () => toast.error(t("common.errorGeneric")),
  });

  const backendProblem = scheme.isError && isBackendStateError(scheme.error);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link
          to="/schemes"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("schemes.title")}
        </Link>

        {scheme.isLoading && <p className="mt-8 text-sm text-muted-foreground">{t("common.loading")}</p>}
        {backendProblem && (
          <div className="mt-8">
            <BackendUnavailableState error={scheme.error} />
          </div>
        )}
        {scheme.isError && !backendProblem && (
          <p className="mt-8 text-sm text-destructive">{t("common.errorGeneric")}</p>
        )}

        {scheme.data && (
          <article className="mt-6 space-y-6">
            <header className="rounded-3xl border border-border/70 bg-card p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-3xl">{scheme.data.name}</h1>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-4 w-4" aria-hidden />
                      {scheme.data.department}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4" aria-hidden />
                      {scheme.data.beneficiaries}
                    </span>
                    {scheme.data.last_verified_date && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" aria-hidden />
                        {t("schemes.lastVerified")}: {scheme.data.last_verified_date}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {scheme.data.level === "central" ? t("schemes.central") : t("schemes.state")}
                    {scheme.data.state_name ? ` · ${scheme.data.state_name}` : ""}
                  </Badge>
                  {scheme.data.is_demo && <Badge variant="outline">Demo</Badge>}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => save.mutate()}
                    disabled={saved || save.isPending}
                  >
                    {saved ? <Check className="h-4 w-4" aria-hidden /> : <BookmarkPlus className="h-4 w-4" aria-hidden />}
                    {saved ? t("common.saved") : t("rights.save")}
                  </Button>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{scheme.data.description}</p>
              {scheme.data.official_url && (
                <a
                  href={scheme.data.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  {t("schemes.officialPage")}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </header>

            <section className="rounded-2xl border border-border/70 bg-card p-6">
              <h2 className="font-display text-xl">{t("schemes.eligibilityRules")}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {scheme.data.eligibility.map((rule, i) => (
                  <li key={i} className="rounded-xl bg-muted/40 px-4 py-2.5">
                    <span className="font-medium capitalize">{rule.field.replace(/_/g, " ")}</span>
                    {rule.values?.length ? `: ${rule.values.join(", ")}` : ""}
                    {rule.min !== undefined ? `: at least ${rule.min}` : ""}
                    {rule.max !== undefined ? `: up to ${rule.max}` : ""}
                    {rule.note ? ` — ${rule.note}` : ""}
                  </li>
                ))}
                {scheme.data.eligibility.length === 0 && (
                  <li className="text-muted-foreground">See the official page for published eligibility conditions.</li>
                )}
              </ul>
            </section>

            {scheme.data.benefits && (
              <section className="rounded-2xl border border-border/70 bg-card p-6">
                <h2 className="font-display text-xl">{t("schemes.benefits")}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{scheme.data.benefits}</p>
              </section>
            )}

            {scheme.data.required_documents && (
              <section className="rounded-2xl border border-border/70 bg-card p-6">
                <h2 className="font-display text-xl">{t("schemes.documents")}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{scheme.data.required_documents}</p>
              </section>
            )}

            {scheme.data.application_process && (
              <section className="rounded-2xl border border-border/70 bg-card p-6">
                <h2 className="font-display text-xl">{t("schemes.process")}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{scheme.data.application_process}</p>
              </section>
            )}

            <footer className="rounded-xl bg-secondary/60 p-4 text-xs leading-relaxed text-secondary-foreground">
              {t("schemes.eligibilityDisclaimer")} Source: {scheme.data.source_reference}
              {scheme.data.last_verified_date ? ` · ${t("schemes.lastVerified")} ${scheme.data.last_verified_date}` : ""}
            </footer>
          </article>
        )}
      </div>
    </AppShell>
  );
}
