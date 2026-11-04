import { Link } from "@tanstack/react-router";
import { LibraryBig } from "lucide-react";
import { useI18n } from "@/i18n";
import { useMyRoles } from "@/hooks/use-my-roles";

/**
 * Shown when the backend is healthy but no legal document has been approved.
 * Never shows placeholder Acts.
 */
export function EmptyKnowledgeBase() {
  const { t } = useI18n();
  const { data: me } = useMyRoles();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center rounded-3xl border border-border/70 bg-card px-6 py-12 text-center sm:px-8">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <LibraryBig className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="mt-5 font-display text-2xl">{t("kb.emptyTitle")}</h2>
      {me?.isAdmin ? (
        <>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("kb.emptyAdmin")}</p>
          <Link
            to="/admin"
            className="mt-6 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("kb.openAdmin")}
          </Link>
        </>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("kb.emptyUser")}</p>
      )}
    </div>
  );
}
