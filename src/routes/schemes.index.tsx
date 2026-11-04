import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Landmark, Search, ArrowRight, ClipboardList } from "lucide-react";
import { api, isBackendStateError, type Scheme, type EligibilityRecommendation } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { BackendUnavailableState } from "@/components/backend-state";
import { useI18n } from "@/i18n";
import { ELIGIBILITY_QUESTIONS, groupByBucket, bucketLabelKey, BUCKET_ORDER } from "@/lib/scheme-buckets";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/schemes")({
  head: () => ({
    meta: [
      { title: "Government Schemes — Nyaya Sakhi" },
      {
        name: "description",
        content: "Explore government welfare schemes for women and check your eligibility.",
      },
      { property: "og:title", content: "Government Schemes — Nyaya Sakhi" },
      {
        property: "og:description",
        content: "Explore government welfare schemes for women and check your eligibility.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Schemes,
});

function Schemes() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);

  const schemes = useQuery({
    queryKey: ["schemes"],
    queryFn: () => api.schemes.list(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  const recommend = useMutation({
    mutationFn: (body: Record<string, string>) => api.schemes.recommend(body),
    onError: () => {}, // handled by rendering state
  });

  const backendProblem = schemes.isError && isBackendStateError(schemes.error);
  const all: Scheme[] = schemes.data ?? [];
  const states = [...new Set(all.map((s) => s.state_name).filter((s): s is string => !!s))].sort();

  const filtered = all.filter((s) => {
    const matchesLevel = level === "all" || s.level === level;
    const matchesState = stateFilter === "all" || s.level === "central" || s.state_name === stateFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    return matchesLevel && matchesState && matchesSearch;
  });

  const rec: EligibilityRecommendation | undefined = recommend.data;
  const grouped = rec ? groupByBucket(rec.results) : null;
  const formComplete = ELIGIBILITY_QUESTIONS.every((q) => (answers[q.key] ?? "").trim() !== "");

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl bg-secondary/70 p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Landmark className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-4xl">{t("schemes.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("schemes.subtitle")}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("schemes.searchPlaceholder")}
              aria-label={t("schemes.searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger aria-label={t("schemes.allLevels")} className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("schemes.allLevels")}</SelectItem>
              <SelectItem value="central">{t("schemes.central")}</SelectItem>
              <SelectItem value="state">{t("schemes.state")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger aria-label={t("schemes.allStates")} className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("schemes.allStates")}</SelectItem>
              {states.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {schemes.isLoading && <p className="mt-8 text-sm text-muted-foreground">{t("common.loading")}</p>}
        {backendProblem && (
          <div className="mt-8">
            <BackendUnavailableState error={schemes.error} />
          </div>
        )}
        {schemes.isError && !backendProblem && (
          <p className="mt-8 text-sm text-destructive">{t("common.errorGeneric")}</p>
        )}
        {schemes.data && all.length === 0 && (
          <p className="mt-8 rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-6 text-sm text-muted-foreground">
            {t("schemes.noSchemes")}
          </p>
        )}

        {/* Eligibility questionnaire */}
        <section className="mt-10 rounded-3xl border border-border/70 bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-2xl">{t("schemes.eligibilityTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("schemes.eligibilityIntro")}</p>
            </div>
          </div>

          {!showForm ? (
            <Button className="mt-5" onClick={() => setShowForm(true)}>
              {t("schemes.eligibilityTitle")}
            </Button>
          ) : (
            <>
              <form
                className="mt-6 grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (formComplete) recommend.mutate(answers);
                }}
              >
                {ELIGIBILITY_QUESTIONS.map((q) => (
                  <div key={q.key}>
                    <label htmlFor={`q-${q.key}`} className="mb-1.5 block text-sm font-medium">
                      {q.label}
                    </label>
                    {q.type === "text" ? (
                      <Input
                        id={`q-${q.key}`}
                        value={answers[q.key] ?? ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                        placeholder="e.g. Karnataka"
                        autoComplete="off"
                      />
                    ) : (
                      <Select
                        value={answers[q.key] ?? ""}
                        onValueChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))}
                      >
                        <SelectTrigger id={`q-${q.key}`}>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {q.options.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={!formComplete || recommend.isPending}>
                    {t("schemes.seeResults")}
                  </Button>
                </div>
              </form>

              {recommend.isPending && <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p>}
              {recommend.isError && !isBackendStateError(recommend.error) && (
                <p className="mt-4 text-sm text-destructive">{t("common.errorGeneric")}</p>
              )}

              {grouped && (
                <div className="mt-6 space-y-6">
                  {BUCKET_ORDER.map((bucket) => {
                    const items = grouped[bucket];
                    if (!items.length) return null;
                    return (
                      <div key={bucket}>
                        <h3 className="font-semibold">
                          {t(bucketLabelKey(bucket))}{" "}
                          <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
                        </h3>
                        <ul className="mt-2 space-y-2">
                          {items.map((r) => (
                            <li
                              key={r.scheme_id}
                              className="rounded-xl border border-border/70 bg-background p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-medium">{r.name}</span>
                                <Link
                                  to="/schemes/$id"
                                  params={{ id: r.scheme_id }}
                                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                                >
                                  Details
                                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                                </Link>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">{r.reason}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                  <p className="rounded-xl bg-accent/60 p-4 text-xs leading-relaxed text-accent-foreground">
                    {rec?.disclaimer ?? t("schemes.eligibilityDisclaimer")}
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {/* Scheme cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {filtered.map((s) => (
            <Link
              key={s.id}
              to="/schemes/$id"
              params={{ id: s.id }}
              className="group rounded-2xl border border-border/70 bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-semibold group-hover:text-primary">{s.name}</h2>
                <div className="flex gap-1.5">
                  <Badge variant="secondary">{s.level === "central" ? t("schemes.central") : t("schemes.state")}</Badge>
                  {s.is_demo && <Badge variant="outline">Demo</Badge>}
                </div>
              </div>
              <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
              <p className="mt-3 text-xs text-muted-foreground">{s.department}</p>
            </Link>
          ))}
        </div>
        {schemes.data && filtered.length === 0 && (
          <p className="mt-6 rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-6 text-sm text-muted-foreground">
            Nothing matches this filter.
          </p>
        )}
      </div>
    </AppShell>
  );
}
