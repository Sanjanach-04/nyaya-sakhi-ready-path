import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, BookmarkPlus, Check, ExternalLink } from "lucide-react";
import { api, isBackendStateError } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { BackendUnavailableState } from "@/components/backend-state";
import { GlossaryText } from "@/components/glossary-text";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/rights/$actId")({
  head: () => ({
    meta: [
      { title: "Act details — Nyaya Sakhi" },
      {
        name: "description",
        content: "Provisions of a verified Indian Act, explained in plain language with sources.",
      },
      { property: "og:title", content: "Act details — Nyaya Sakhi" },
      {
        property: "og:description",
        content: "Provisions of a verified Indian Act, explained in plain language with sources.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActDetail,
});

function ActDetail() {
  const { t } = useI18n();
  const { actId } = Route.useParams();
  const [saved, setSaved] = useState(false);

  const act = useQuery({
    queryKey: ["legal-act", actId],
    queryFn: () => api.legal.act(actId),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  const save = useMutation({
    mutationFn: () =>
      api.saved.create({
        item_type: "act",
        ref_id: actId,
        title: act.data?.title ?? "Act",
      }),
    onSuccess: () => {
      setSaved(true);
      toast.success(t("rights.savedItem"));
    },
    onError: () => toast.error(t("common.errorGeneric")),
  });

  const backendProblem = act.isError && isBackendStateError(act.error);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link
          to="/rights"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("nav.rights")}
        </Link>

        {act.isLoading && <p className="mt-8 text-sm text-muted-foreground">{t("common.loading")}</p>}
        {backendProblem && (
          <div className="mt-8">
            <BackendUnavailableState error={act.error} />
          </div>
        )}
        {act.isError && !backendProblem && (
          <p className="mt-8 text-sm text-destructive">{t("common.errorGeneric")}</p>
        )}

        {act.data && (
          <article className="mt-6">
            <div className="rounded-3xl border border-border/70 bg-card p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-3xl">{act.data.title}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {act.data.act_name} · {act.data.category} · version {act.data.version}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {act.data.is_demo && <Badge variant="outline">{t("rights.demoBadge")}</Badge>}
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
              {(act.data.description ?? act.data.summary) && (
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {act.data.description ?? act.data.summary}
                </p>
              )}
              {act.data.source_title && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("chat.source")}: {act.data.source_title} · version {act.data.source_version}
                  {act.data.source_url && (
                    <>
                      {" · "}
                      <a
                        href={act.data.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        Official source
                        <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>

            <section className="mt-8">
              <h2 className="font-display text-2xl">{t("rights.provisions")}</h2>
              {act.data.provisions.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-6 text-sm text-muted-foreground">
                  {t("rights.noProvisions")}
                </p>
              ) : (
                <Accordion type="single" collapsible className="mt-3 space-y-2">
                  {act.data.provisions.map((p) => (
                    <AccordionItem
                      key={p.chunk_id}
                      value={p.chunk_id}
                      className="rounded-2xl border border-border/70 bg-card px-5"
                    >
                      <AccordionTrigger className="text-left hover:no-underline">
                        <span className="font-medium">
                          {p.section_number ? `${p.section_number}. ` : ""}
                          {p.section_title ?? p.act_name}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        {p.plain_explanation && (
                          <div className="rounded-xl bg-secondary/60 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
                              {t("rights.plainExplanation")}
                            </p>
                            <p className="mt-1 text-sm leading-relaxed">
                              <GlossaryText text={p.plain_explanation} />
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("rights.originalText")}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                            <GlossaryText text={p.content} />
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </section>
          </article>
        )}
      </div>
    </AppShell>
  );
}
