import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PhoneCall, Siren, Info, ArrowRight } from "lucide-react";
import { api, isBackendStateError, type EmergencyContact } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { BackendUnavailableState } from "@/components/backend-state";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/emergency")({
  head: () => ({
    meta: [
      { title: "Emergency Helplines — Nyaya Sakhi" },
      {
        name: "description",
        content: "Verified emergency helplines for women in India — one tap to call.",
      },
      { property: "og:title", content: "Emergency Helplines — Nyaya Sakhi" },
      {
        property: "og:description",
        content: "Verified emergency helplines for women in India — one tap to call.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Emergency,
});

function Emergency() {
  const { t } = useI18n();
  const contacts = useQuery({
    queryKey: ["emergency-contacts"],
    queryFn: () => api.emergency.list(),
    retry: (failureCount, error) => !isBackendStateError(error) && failureCount < 2,
  });

  const categories = contacts.data
    ? [...new Set(contacts.data.map((c: EmergencyContact) => c.category))]
    : [];

  const backendProblem = isBackendStateError(contacts.error);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl bg-accent p-8 text-accent-foreground">
          <Siren className="h-9 w-9" aria-hidden />
          <h1 className="mt-3 font-display text-4xl">{t("emergency.title")}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed">{t("emergency.subtitle")}</p>
        </div>

        {/* Always-available verified national numbers */}
        <div className="mt-6 rounded-2xl border border-accent-pink/30 bg-accent p-5 text-sm leading-snug text-accent-foreground">
          <strong>In danger right now?</strong> Call{" "}
          <a href="tel:112" className="font-semibold underline">112</a> (national emergency) or{" "}
          <a href="tel:1091" className="font-semibold underline">1091</a> (women's helpline).
        </div>

        {contacts.isLoading && (
          <p className="mt-8 text-sm text-muted-foreground">{t("common.loading")}</p>
        )}
        {contacts.isError && !backendProblem && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load helplines. Please refresh and try again.
          </p>
        )}
        {backendProblem && (
          <div className="mt-8">
            <BackendUnavailableState error={contacts.error} />
          </div>
        )}

        {categories.map((cat) => (
          <section key={cat} className="mt-8">
            <h2 className="font-display text-2xl">{cat}</h2>
            <ul className="mt-3 space-y-3">
              {contacts
                .data!.filter((c) => c.category === cat)
                .sort((a, b) => a.display_order - b.display_order)
                .map((c) => (
                  <li
                    key={c.id}
                    className="rounded-2xl border border-border/70 bg-card p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{c.name}</h3>
                          {c.is_demo && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                              Demo entry — development data
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{c.purpose}</p>
                        {c.availability && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Available: {c.availability}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground/80">
                          Source: {c.source_reference}
                        </p>
                      </div>
                      <a
                        href={`tel:${c.phone_number.replace(/[^0-9+]/g, "")}`}
                        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        <PhoneCall className="h-4 w-4" aria-hidden />
                        Call {c.phone_number}
                      </a>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ))}

        {contacts.data && contacts.data.length === 0 && (
          <p className="mt-8 rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-6 text-sm text-muted-foreground">
            No helplines listed yet. Administrators add verified official contacts only — none are invented.
          </p>
        )}

        <p className="mt-10 flex items-start gap-2 rounded-xl bg-secondary/60 p-4 text-xs leading-relaxed text-secondary-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Helpline details are stored with their source references and shown above. Nyaya Sakhi
          never invents contact numbers; entries are maintained by administrators from official
          publications.
        </p>

        <p className="mt-4 text-center">
          <Link
            to="/legal-aid"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Looking for longer-term legal help? Visit Legal Aid
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
