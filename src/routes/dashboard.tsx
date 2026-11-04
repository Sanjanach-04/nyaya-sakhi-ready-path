import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  MessageCircleHeart,
  BookOpenText,
  Landmark,
  FileEdit,
  HeartHandshake,
  PhoneCall,
  History,
  ArrowRight,
  Siren,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useMyRoles } from "@/components/app-shell";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — Nyaya Sakhi" },
      {
        name: "description",
        content:
          "Your legal assistant, rights library, schemes explorer, complaint drafter, legal aid directory and emergency helplines.",
      },
      { property: "og:title", content: "Your dashboard — Nyaya Sakhi" },
      {
        property: "og:description",
        content: "Legal literacy tools for women — verified answers, schemes, drafts and helplines in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const modules = [
  {
    to: "/chat",
    icon: MessageCircleHeart,
    titleKey: "nav.chat" as const,
    title: "AI Legal Assistant",
    text: "Ask a legal question, get a simple explanation with Act and Section citations.",
    tint: "secondary" as const,
  },
  {
    to: "/rights",
    icon: BookOpenText,
    titleKey: "nav.rights" as const,
    title: "Know Your Rights",
    text: "Browse verified Acts and provisions in plain language.",
    tint: "accent" as const,
  },
  {
    to: "/schemes",
    icon: Landmark,
    titleKey: "nav.schemes" as const,
    title: "Government Schemes",
    text: "Explore schemes for women and check your eligibility.",
    tint: "secondary" as const,
  },
  {
    to: "/drafter",
    icon: FileEdit,
    titleKey: "nav.drafter" as const,
    title: "Complaint & Application Helper",
    text: "Draft a complaint or application and download it as a PDF.",
    tint: "accent" as const,
  },
  {
    to: "/legal-aid",
    icon: HeartHandshake,
    titleKey: "nav.legalAid" as const,
    title: "Legal Aid & Support",
    text: "NALSA and your State or District Legal Services Authority — official contacts.",
    tint: "secondary" as const,
  },
  {
    to: "/emergency",
    icon: PhoneCall,
    titleKey: "nav.emergency" as const,
    title: "Emergency Help",
    text: "Verified national helplines, one tap to call — kept separate from the chatbot.",
    tint: "accent" as const,
  },
  {
    to: "/history",
    icon: History,
    titleKey: "nav.history" as const,
    title: "My Queries & History",
    text: "Your conversations, saved information and drafts — private to you.",
    tint: "secondary" as const,
  },
];

function Dashboard() {
  const { t } = useI18n();
  const { data: me } = useMyRoles();

  const profile = useQuery({
    queryKey: ["my-profile", me?.userId],
    enabled: !!me?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, preferred_language")
        .eq("id", me!.userId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const recentSessions = useQuery({
    queryKey: ["recent-chat-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  const name = profile.data?.display_name || "there";

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm font-medium text-muted-foreground">{t("dashboard.greeting")}</p>
        <h1 className="mt-1 font-display text-4xl sm:text-5xl">{name}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t("dashboard.subtitle")}</p>

        {/* Emergency quick strip */}
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-accent-pink/30 bg-accent p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Siren className="h-6 w-6 shrink-0 text-accent-foreground" aria-hidden />
            <p className="text-sm leading-snug text-accent-foreground">
              {t("dashboard.emergencyStrip")}
            </p>
          </div>
          <Link
            to="/emergency"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-foreground px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent-foreground/90"
          >
            {t("dashboard.allHelplines")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {/* Module cards (7 sections) */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="group rounded-2xl border border-border/70 bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                  m.tint === "accent"
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                <m.icon className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold group-hover:text-primary">
                {t(m.titleKey) !== m.titleKey ? t(m.titleKey) : m.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{m.text}</p>
            </Link>
          ))}

          {me?.isAdmin && (
            <Link
              to="/admin"
              className="group rounded-2xl border border-primary/30 bg-primary p-6 text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/15">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold">{t("dashboard.adminArea")}</h2>
              <p className="mt-1.5 text-sm leading-relaxed opacity-90">
                Upload and verify legal documents, manage schemes, helplines and legal aid data, and view usage stats.
              </p>
            </Link>
          )}

          <Link
            to="/profile"
            className="group rounded-2xl border border-border/70 bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <UserRound className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-4 font-semibold group-hover:text-primary">{t("nav.profile")}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Your name, language, password and data controls.
            </p>
          </Link>
        </div>

        {/* Recent queries */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">{t("dashboard.recentQuestions")}</h2>
            <Link
              to="/chat"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {t("dashboard.newQuestion")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          {recentSessions.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : recentSessions.data && recentSessions.data.length > 0 ? (
            <ul className="mt-4 divide-y divide-border/70 rounded-2xl border border-border/70 bg-card">
              {recentSessions.data.map((s) => (
                <li key={s.id}>
                  <Link
                    to="/chat/$threadId"
                    params={{ threadId: s.id }}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-muted/60"
                  >
                    <span className="truncate text-sm font-medium">{s.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(s.updated_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-6 text-sm text-muted-foreground">
              {t("dashboard.noQuestions")}
            </p>
          )}
        </section>

        <p className="mt-10 rounded-xl bg-secondary/60 p-4 text-xs leading-relaxed text-secondary-foreground">
          {t("dashboard.disclaimer")}
        </p>
      </div>
    </AppShell>
  );
}
