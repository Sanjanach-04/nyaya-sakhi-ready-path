import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { UserRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { api, isBackendStateError } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { BackendUnavailableState } from "@/components/backend-state";
import { useI18n, LANGUAGES, type LanguageCode } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Nyaya Sakhi" },
      {
        name: "description",
        content: "Your name, preferred language, password and data controls.",
      },
      { property: "og:title", content: "My Profile — Nyaya Sakhi" },
      { property: "og:description", content: "Your name, preferred language, password and data controls." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { t, language, setLanguage } = useI18n();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const me = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return { id: data.user?.id ?? null, email: data.user?.email ?? null };
    },
  });

  const profile = useQuery({
    queryKey: ["api-profile"],
    queryFn: () => api.auth.getProfile(),
    retry: (count, error) => !isBackendStateError(error) && count < 2,
  });

  if (profile.data && loadedFor !== profile.data.id) {
    setLoadedFor(profile.data.id);
    setDisplayName(profile.data.display_name ?? "");
    if (profile.data.preferred_language !== language) {
      setLanguage(profile.data.preferred_language as LanguageCode);
    }
  }

  const saveProfile = useMutation({
    mutationFn: () =>
      api.auth.updateProfile({ display_name: displayName.trim(), preferred_language: language }),
    onSuccess: () => {
      toast.success(t("profile.profileSaved"));
      queryClient.invalidateQueries({ queryKey: ["api-profile"] });
      // Mirror to the Supabase profile row so the app shell sees it too.
      if (me.data?.id) {
        void supabase
          .from("profiles")
          .update({ display_name: displayName.trim(), preferred_language: language })
          .eq("id", me.data.id);
      }
    },
    onError: (e) => {
      if (!isBackendStateError(e)) toast.error(t("common.errorGeneric"));
    },
  });

  const changePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setChangingPassword(true);
    try {
      // Verify the current password first.
      const email = me.data?.email;
      if (email) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (signInError) {
          toast.error("Current password is not correct.");
          return;
        }
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("profile.passwordUpdated"));
      setCurrentPassword("");
      setNewPassword("");
    } finally {
      setChangingPassword(false);
    }
  };

  const deleteData = useMutation({
    mutationFn: async () => {
      // Delete user-owned rows directly in the database (RLS-scoped), then
      // ask the backend to clear anything it holds for this user.
      const userId = me.data?.id;
      if (userId) {
        await supabase.from("chat_sessions").delete().eq("user_id", userId);
        await supabase.from("complaint_drafts").delete().eq("user_id", userId);
        await supabase.from("saved_items").delete().eq("user_id", userId);
        await supabase.from("scheme_eligibility_responses").delete().eq("user_id", userId);
      }
      await api.chat.deleteAll();
    },
    onSuccess: () => {
      toast.success(t("profile.dataDeleted"));
      queryClient.invalidateQueries();
    },
    onError: (e) => {
      if (!isBackendStateError(e)) toast.error(t("common.errorGeneric"));
    },
  });

  const backendProblem = profile.isError && isBackendStateError(profile.error);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <UserRound className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="font-display text-4xl">{t("profile.title")}</h1>
        </div>

        {backendProblem && (
          <p className="mt-6 rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
            {t("backend.notConfiguredTitle")} — {t("error.setupHint")}
          </p>
        )}

        <section className="mt-8 rounded-3xl border border-border/70 bg-card p-6">
          <h2 className="font-display text-xl">{t("profile.title")}</h2>
          <div className="mt-4 grid gap-4">
            <div>
              <Label htmlFor="displayName">{t("profile.name")}</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="email">{t("profile.email")}</Label>
              <Input id="email" value={me.data?.email ?? ""} readOnly className="mt-1.5 bg-muted/50" />
            </div>
            <div>
              <Label>{t("profile.language")}</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as LanguageCode)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.native}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending || backendProblem} className="w-fit">
              {saveProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {t("profile.saveProfile")}
            </Button>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-border/70 bg-card p-6">
          <h2 className="font-display text-xl">{t("profile.changePassword")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="currentPassword">{t("profile.currentPassword")}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="newPassword">{t("profile.newPassword")}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="mt-1.5"
              />
            </div>
          </div>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => void changePassword()}
            disabled={changingPassword || !currentPassword || !newPassword}
          >
            {changingPassword && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {t("profile.changePassword")}
          </Button>
        </section>

        <section className="mt-6 rounded-3xl border border-destructive/40 bg-card p-6">
          <h2 className="font-display text-xl text-destructive">{t("profile.deleteData")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("profile.deleteDataWarning")}
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="mt-4">
                {t("profile.deleteData")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("history.confirmDeleteAll")}</AlertDialogTitle>
                <AlertDialogDescription>{t("profile.deleteDataWarning")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteData.mutate()}>{t("common.confirm")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
    </AppShell>
  );
}
