import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { History, Trash2, Bookmark, FileEdit, ArrowRight } from "lucide-react";
import { api, isBackendStateError, type ComplaintDraft, type SavedItem, type ChatSessionSummary } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { BackendUnavailableState } from "@/components/backend-state";
import { useI18n } from "@/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "My History — Nyaya Sakhi" },
      {
        name: "description",
        content: "Your conversations, saved items and complaint drafts — private to your account.",
      },
      { property: "og:title", content: "My History — Nyaya Sakhi" },
      {
        property: "og:description",
        content: "Your conversations, saved items and complaint drafts — private to your account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

type ConfirmTarget = { kind: "one"; id: string; tab: string } | { kind: "all"; tab: string } | null;

function HistoryPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<ConfirmTarget>(null);

  const conversations = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => api.chat.history(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });
  const saved = useQuery({
    queryKey: ["saved-items"],
    queryFn: () => api.saved.list(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });
  const drafts = useQuery({
    queryKey: ["complaint-drafts"],
    queryFn: () => api.complaints.list(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  const deleteThread = useMutation({
    mutationFn: (id: string) => api.chat.deleteThread(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      toast.success(t("common.delete"));
    },
  });
  const deleteAllThreads = useMutation({
    mutationFn: () => api.chat.deleteAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      toast.success(t("common.delete"));
    },
  });
  const deleteSaved = useMutation({
    mutationFn: (id: string) => api.saved.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-items"] });
      toast.success(t("common.delete"));
    },
  });
  const deleteDraft = useMutation({
    mutationFn: (id: string) => api.complaints.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaint-drafts"] });
      toast.success(t("common.delete"));
    },
  });

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "all") {
      if (confirm.tab === "conversations") deleteAllThreads.mutate();
    } else if (confirm.tab === "conversations") {
      deleteThread.mutate(confirm.id);
    } else if (confirm.tab === "saved") {
      deleteSaved.mutate(confirm.id);
    } else if (confirm.tab === "drafts") {
      deleteDraft.mutate(confirm.id);
    }
    setConfirm(null);
  };

  const backendProblem =
    (conversations.isError && isBackendStateError(conversations.error)) ||
    (saved.isError && isBackendStateError(saved.error)) ||
    (drafts.isError && isBackendStateError(drafts.error));

  const sectionHeader = (label: string, onDeleteAll?: () => void, showDeleteAll?: boolean) => (
    <div className="flex items-center justify-between">
      <h2 className="font-display text-lg">{label}</h2>
      {showDeleteAll && onDeleteAll && (
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDeleteAll}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          {t("history.deleteAll")}
        </Button>
      )}
    </div>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <History className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="font-display text-4xl">{t("history.title")}</h1>
        </div>

        {backendProblem && (
          <div className="mt-8">
            <BackendUnavailableState />
          </div>
        )}
        {!backendProblem && (
          <Tabs defaultValue="conversations" className="mt-8">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="conversations">{t("history.tab.conversations")}</TabsTrigger>
              <TabsTrigger value="saved">{t("history.tab.saved")}</TabsTrigger>
              <TabsTrigger value="drafts">{t("history.tab.drafts")}</TabsTrigger>
            </TabsList>

            <TabsContent value="conversations" className="mt-4">
              {sectionHeader(t("history.tab.conversations"), () => setConfirm({ kind: "all", tab: "conversations" }), (conversations.data ?? []).length > 0)}
              {(conversations.data ?? []).length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-6 text-sm text-muted-foreground">
                  {t("history.emptyConversations")}
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border/70 rounded-2xl border border-border/70 bg-card">
                  {(conversations.data as ChatSessionSummary[]).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <Link
                        to="/chat/$threadId"
                        params={{ threadId: s.id }}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3"
                      >
                        <span className="truncate text-sm font-medium">{s.title}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          {new Date(s.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          <ArrowRight className="h-3 w-3" aria-hidden />
                        </span>
                      </Link>
                      <button
                        type="button"
                        aria-label={`${t("history.deleteOne")} ${s.title}`}
                        onClick={() => setConfirm({ kind: "one", id: s.id, tab: "conversations" })}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="saved" className="mt-4">
              {sectionHeader(t("history.tab.saved"))}
              {(saved.data ?? []).length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-6 text-sm text-muted-foreground">
                  {t("history.emptySaved")}
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {(saved.data as SavedItem[]).map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-5 py-3.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Bookmark className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{item.item_type}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`${t("history.deleteOne")} ${item.title}`}
                        onClick={() => setConfirm({ kind: "one", id: item.id, tab: "saved" })}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="drafts" className="mt-4">
              {sectionHeader(t("history.tab.drafts"))}
              {(drafts.data ?? []).length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-6 text-sm text-muted-foreground">
                  {t("history.emptyDrafts")}
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {(drafts.data as ComplaintDraft[]).map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-5 py-3.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <FileEdit className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{d.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.document_type} · {new Date(d.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`${t("history.deleteOne")} ${d.title}`}
                        onClick={() => setConfirm({ kind: "one", id: d.id, tab: "drafts" })}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        )}

        <AlertDialog
          open={!!confirm}
          onOpenChange={(open) => {
            if (!open) setConfirm(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirm?.kind === "all" ? t("history.confirmDeleteAll") : t("history.confirmDeleteOne")}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={runConfirm}>{t("common.delete")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
