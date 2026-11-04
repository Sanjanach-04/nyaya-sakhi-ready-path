import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookOpenText,
  FileEdit,
  HeartHandshake,
  Landmark,
  ScrollText,
  ArrowRight,
} from "lucide-react";
import type { Citation, NextStepOption } from "@/lib/api";
import { useI18n } from "@/i18n";

const NEXT_STEP_ICONS: Record<string, typeof BookOpenText> = {
  "/legal-aid": HeartHandshake,
  "/emergency": Landmark,
  "/drafter": FileEdit,
  "/rights": BookOpenText,
};

export function CitationList({ citations }: { citations: Citation[] }) {
  const { t } = useI18n();
  if (!citations.length) return null;

  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-muted/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("chat.actSection")}
      </p>
      <ul className="mt-2 space-y-2">
        {citations.map((c, i) => (
          <li key={`${c.chunk_id}-${i}`} className="text-sm">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <ScrollText className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="font-medium">
                {c.act}
                {c.section ? `, ${c.section}` : ""}
              </span>
              {c.is_demo && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {t("chat.demoBadge")}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("chat.source")}: {c.document_title} · version {c.document_version}
            </p>
            {c.snippet && (
              <p className="mt-1 border-l-2 border-border pl-2 text-xs italic text-muted-foreground/90">
                “{c.snippet}”
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NextStepCards({ steps }: { steps: NextStepOption[] }) {
  const { t } = useI18n();
  if (!steps.length) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("chat.nextSteps")}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {steps.map((s) => {
          const Icon = NEXT_STEP_ICONS[s.link] ?? ArrowRight;
          return (
            <Link
              key={s.link + s.label}
              to={s.link}
              className="group rounded-xl border border-border/70 bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/50"
            >
              <div className="flex items-center gap-2 text-sm font-medium group-hover:text-primary">
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {s.label}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Distinct style for refusals — honest "I could not verify this" answers. */
export function RefusalCard({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-accent-pink/40 bg-accent/60 p-5">
      <div className="flex items-center gap-2 font-semibold text-accent-foreground">
        <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
        {t("chat.refusalTitle")}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-accent-foreground">{text}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link
          to="/legal-aid"
          className="rounded-xl border border-accent-foreground/20 bg-card p-3 text-sm font-medium transition-colors hover:bg-muted/50"
        >
          <HeartHandshake className="mr-1.5 inline h-4 w-4 text-primary" aria-hidden />
          Find free legal aid
        </Link>
        <Link
          to="/emergency"
          className="rounded-xl border border-accent-foreground/20 bg-card p-3 text-sm font-medium transition-colors hover:bg-muted/50"
        >
          <Landmark className="mr-1.5 inline h-4 w-4 text-primary" aria-hidden />
          Emergency helplines
        </Link>
      </div>
    </div>
  );
}

export interface AssistantAnswerProps {
  explanation: string;
  actName?: string | null;
  sectionNumber?: string | null;
  citations: Citation[];
  nextSteps?: NextStepOption[];
  refused?: boolean;
}

export function AssistantAnswer({
  explanation,
  actName,
  sectionNumber,
  citations,
  nextSteps,
  refused,
}: AssistantAnswerProps) {
  const { t } = useI18n();

  if (refused) return <RefusalCard text={explanation} />;

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{explanation}</p>
      {actName && (
        <p className="mt-3 text-sm font-medium">
          {t("chat.actSection")}: {actName}
          {sectionNumber ? `, ${sectionNumber}` : ""}
        </p>
      )}
      <CitationList citations={citations} />
      {nextSteps && <NextStepCards steps={nextSteps} />}
      <p className="mt-4 border-t border-border/60 pt-3 text-[11px] leading-relaxed text-muted-foreground">
        {t("chat.disclaimer")}
      </p>
    </div>
  );
}
