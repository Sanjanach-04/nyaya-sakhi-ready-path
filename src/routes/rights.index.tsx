import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpenText, ArrowRight, Search } from "lucide-react";
import { api, isBackendStateError, type LegalActSummary } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { BackendUnavailableState } from "@/components/backend-state";
import { EmptyKnowledgeBase } from "@/components/empty-knowledge-base";
import { useI18n } from "@/i18n";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/rights/")({
  head: () => ({
    meta: [
      { title: "Know Your Rights — Nyaya Sakhi" },
      {
        name: "description",
        content: "Browse verified Indian Acts and their provisions explained in plain language.",
      },
      { property: "og:title", content: "Know Your Rights — Nyaya Sakhi" },
      {
        property: "og:description",
        content: "Browse verified Indian Acts and their provisions explained in plain language.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rights,
});

function Rights() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const acts = useQuery({
    queryKey: ["legal-acts"],
    queryFn: () => api.legal.acts(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  const backendProblem = acts.isError && isBackendStateError(acts.error);
  const all: LegalActSummary[] = acts.data ?? [];
  const categories = [...new Set(all.map((a) => a.category))].sort();

  const filtered = all.filter((a) => {
    const matchesCategory = category === "all" || a.category === category;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.act_name.toLowerCase().includes(q) ||
      (a.description ?? "").toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl bg-secondary/70 p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BookOpenText className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-4xl">{t("rights.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("rights.subtitle")}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("rights.searchPlaceholder")}
              aria-label={t("rights.searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger aria-label={t("rights.allCategories")} className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("rights.allCategories")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {acts.isLoading && <p className="mt-8 text-sm text-muted-foreground">{t("common.loading")}</p>}

        {backendProblem && (
          <div className="mt-8">
            <BackendUnavailableState error={acts.error} />
          </div>
        )}

        {acts.isError && !backendProblem && (
          <p className="mt-8 text-sm text-destructive">{t("common.errorGeneric")}</p>
        )}

        {acts.data && all.length === 0 && (
          <div className="mt-8">
            <EmptyKnowledgeBase />
          </div>
        )}

        {acts.data && all.length > 0 && filtered.length === 0 && (
          <p className="mt-8 rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-6 text-sm text-muted-foreground">
            Nothing matches this filter.
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {filtered.map((a) => (
            <Link
              key={a.id}
              to="/rights/$actId"
              params={{ actId: a.id }}
              className="group rounded-2xl border border-border/70 bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold group-hover:text-primary">{a.title}</h2>
                {a.is_demo && <Badge variant="outline">{t("rights.demoBadge")}</Badge>}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {a.description ?? a.summary ?? a.act_name}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {a.category} · version {a.version}
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Open
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
