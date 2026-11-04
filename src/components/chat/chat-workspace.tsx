import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  Copy,
  Plus,
  Trash2,
  MessageCircleHeart,
  Loader2,
  Check,
} from "lucide-react";
import {
  api,
  isBackendStateError,
  type ChatMessage as ApiChatMessage,
  type ChatSessionSummary,
  type Citation,
} from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { BackendUnavailableState } from "@/components/backend-state";
import { AssistantAnswer } from "@/components/chat/answer-card";
import { useSpeechRecognition, speakText, stopSpeaking } from "@/hooks/use-speech";
import { useI18n, type LanguageCode } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const SUGGESTED_QUESTIONS = [
  "What can I do if I face dowry harassment at home?",
  "My workplace is not acting on my harassment complaint. What are my rights?",
  "Can I get financial maintenance after separation?",
  "How do I file a police complaint for domestic violence?",
];

interface WorkspaceProps {
  threadId?: string;
}

export function ChatWorkspace({ threadId }: WorkspaceProps) {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [input, setInput] = React.useState("");
  const [answerLanguage, setAnswerLanguage] = React.useState<LanguageCode>(language);
  const [pendingQuestion, setPendingQuestion] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [ttsNote, setTtsNote] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  const speech = useSpeechRecognition(answerLanguage);

  const threads = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => api.chat.history(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  const thread = useQuery({
    queryKey: ["chat-thread", threadId],
    enabled: !!threadId,
    queryFn: () => api.chat.thread(threadId!),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  React.useEffect(() => {
    setAnswerLanguage(language);
  }, [language]);

  React.useEffect(() => {
    if (speech.transcript) setInput(speech.transcript);
  }, [speech.transcript]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.data?.messages.length, pendingQuestion]);

  const backendProblem =
    threads.isError && isBackendStateError(threads.error);

  const ask = useMutation({
    mutationFn: async (question: string) => {
      setPendingQuestion(question);
      setInput("");
      try {
        return await api.chat.ask({
          question,
          language: answerLanguage,
          session_id: threadId ?? null,
        });
      } finally {
        setPendingQuestion(null);
      }
    },
    onSuccess: (answer) => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      queryClient.invalidateQueries({ queryKey: ["chat-thread", answer.session_id] });
      if (!threadId) {
        navigate({ to: "/chat/$threadId", params: { threadId: answer.session_id }, replace: true });
      }
    },
    onError: (error) => {
      if (!isBackendStateError(error)) toast.error(t("common.errorGeneric"));
    },
  });

  const deleteThread = useMutation({
    mutationFn: () => api.chat.deleteThread(threadId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      toast.success(t("common.delete"));
      navigate({ to: "/chat", replace: true });
    },
  });

  const copyAnswer = async (msg: ApiChatMessage) => {
    await navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id);
    toast.success(t("common.copied"));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const readAloud = async (msg: ApiChatMessage) => {
    stopSpeaking();
    const result = await speakText(msg.content, answerLanguage);
    if (result === "unavailable") {
      setTtsNote(t("chat.ttsUnavailable"));
      toast.info(t("chat.ttsUnavailable"));
      setTimeout(() => setTtsNote(null), 6000);
    }
  };

  const messages: ApiChatMessage[] = thread.data?.messages ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || ask.isPending) return;
    ask.mutate(question);
  };

  const handleMic = () => {
    if (!speech.supported) {
      toast.info(t("chat.micUnsupported"));
      return;
    }
    if (speech.listening) speech.stop();
    else speech.start();
  };

  const micButton = (
    <button
      type="button"
      onClick={handleMic}
      aria-label={t("chat.mic")}
      title={speech.supported ? t("chat.mic") : t("chat.micUnsupported")}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-input bg-card transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring ${
        speech.listening ? "bg-accent text-accent-foreground animate-pulse" : ""
      }`}
    >
      {speech.supported ? <Mic className="h-4.5 w-4.5" aria-hidden /> : <MicOff className="h-4.5 w-4.5" aria-hidden />}
    </button>
  );

  const composer = (
    <form onSubmit={submit} className="border-t border-border/60 bg-background p-3 sm:p-4">
      {speech.error && <p className="mb-2 text-xs text-destructive">{speech.error}</p>}
      {ttsNote && <p className="mb-2 text-xs text-muted-foreground">{ttsNote}</p>}
      <div className="flex items-end gap-2">
        {micButton}
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
          placeholder={t("chat.placeholder")}
          aria-label={t("chat.placeholder")}
          rows={1}
          className="min-h-11 flex-1 resize-none rounded-2xl"
        />
        <Button
          type="submit"
          size="icon"
          disabled={ask.isPending || !input.trim()}
          aria-label={t("chat.send")}
          className="h-11 w-11 shrink-0 rounded-full"
        >
          {ask.isPending ? <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden /> : <Send className="h-4.5 w-4.5" aria-hidden />}
        </Button>
      </div>
    </form>
  );

  const messageList = (
    <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
              {m.content}
            </div>
          </div>
        ) : (
          <div key={m.id} className="max-w-3xl space-y-1.5">
            <AssistantAnswer
              explanation={m.content}
              citations={(m.citations ?? []) as Citation[]}
              refused={!!m.refused}
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void copyAnswer(m)}
                aria-label={t("chat.copyAnswer")}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-input bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
              >
                {copiedId === m.id ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
                {t("common.copy")}
              </button>
              <button
                type="button"
                onClick={() => void readAloud(m)}
                aria-label={t("chat.readAloud")}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-input bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
              >
                <Volume2 className="h-3 w-3" aria-hidden />
                {t("chat.readAloud")}
              </button>
            </div>
          </div>
        ),
      )}

      {pendingQuestion && (
        <>
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
              {pendingQuestion}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t("chat.thinking")}
          </div>
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );

  const emptyState = (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
        <MessageCircleHeart className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="mt-4 font-display text-2xl">{t("chat.title")}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {t("chat.placeholder")}
      </p>
      <div className="mt-6 w-full max-w-md space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("chat.suggested")}
        </p>
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => ask.mutate(q)}
            className="w-full rounded-xl border border-border/70 bg-card px-4 py-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-muted/50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );

  const sidebar = (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-card/50 md:flex">
      <div className="p-3">
        <Link
          to="/chat"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t("chat.newConversation")}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("chat.conversations")}
        </p>
        {threads.isLoading && <p className="px-2 py-2 text-xs text-muted-foreground">{t("common.loading")}</p>}
        <ul className="space-y-1">
          {(threads.data ?? []).map((s: ChatSessionSummary) => (
            <li key={s.id}>
              <Link
                to="/chat/$threadId"
                params={{ threadId: s.id }}
                className={`block truncate rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  threadId === s.id
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {s.title}
              </Link>
            </li>
          ))}
        </ul>
        {!threads.isLoading && (threads.data ?? []).length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">{t("history.emptyConversations")}</p>
        )}
      </div>
      <div className="border-t border-border/60 p-3">
        <Link
          to="/history"
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {t("nav.history")}
        </Link>
      </div>
    </aside>
  );

  return (
    <AppShell>
      {backendProblem ? (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <BackendUnavailableState error={threads.error} />
        </div>
      ) : (
        <div className="mx-auto flex h-[calc(100vh-9.5rem)] max-w-6xl overflow-hidden rounded-none border-border/60 md:my-4 md:rounded-3xl md:border">
          {sidebar}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
              <h1 className="truncate font-display text-lg">
                {thread.data?.session.title ?? t("chat.title")}
              </h1>
              <div className="flex items-center gap-2">
                <Select value={answerLanguage} onValueChange={(v) => setAnswerLanguage(v as LanguageCode)}>
                  <SelectTrigger aria-label={t("chat.language")} className="h-8 w-[7.5rem] rounded-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">हिन्दी</SelectItem>
                    <SelectItem value="kn">ಕನ್ನಡ</SelectItem>
                  </SelectContent>
                </Select>
                {threadId && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    aria-label={t("chat.deleteConversation")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-input bg-card text-muted-foreground transition-colors hover:bg-accent"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
            </div>

            {threadId && thread.isLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {t("common.loading")}
              </div>
            ) : threadId && thread.isError ? (
              <div className="flex flex-1 items-center justify-center px-6">
                {isBackendStateError(thread.error) ? (
                  <BackendUnavailableState error={thread.error} />
                ) : (
                  <p className="text-sm text-muted-foreground">{t("common.errorGeneric")}</p>
                )}
              </div>
            ) : messages.length === 0 && !pendingQuestion ? (
              emptyState
            ) : (
              messageList
            )}

            {composer}
          </div>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("history.confirmDeleteOne")}</AlertDialogTitle>
            <AlertDialogDescription>{t("chat.deleteConversation")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(false);
                deleteThread.mutate();
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

