import * as React from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu, Scale, Siren, LogOut, UserRound, Languages, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, LANGUAGES, type LanguageCode } from "@/i18n";
import { NAV_ITEMS } from "@/lib/nav";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Read the signed-in user's app roles (own rows only, via RLS). */
export function useMyRoles() {
  return useQuery({
    queryKey: ["my-roles"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return { userId: null, isAdmin: false, email: null as string | null };
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      return {
        userId,
        isAdmin: roles.some((r) => r.role === "admin"),
        email: userData.user?.email ?? null,
      };
    },
    staleTime: 60_000,
  });
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, language, setLanguage } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: me } = useMyRoles();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || me?.isAdmin);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.invalidate();
    await router.navigate({ to: "/auth", replace: true });
  };

  const changeLanguage = async (lang: LanguageCode) => {
    setLanguage(lang);
    // Best-effort persistence to the user's profile (Supabase auth data).
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase
          .from("profiles")
          .update({ preferred_language: lang })
          .eq("id", userData.user.id);
      }
    } catch {
      // Profile persistence is optional; the choice stays for this device.
    }
  };

  const logo = (
    <Link to="/dashboard" className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Scale className="h-5 w-5" aria-hidden />
      </span>
      <span className="font-display text-xl leading-none">
        {t("app.name")}
        <span className="block font-sans text-[10px] font-medium tracking-wide text-muted-foreground">
          {t("app.tagline")}
        </span>
      </span>
    </Link>
  );

  const navLinkClass = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
      active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
    }`;

  const emergencyButton = (
    <Link
      to="/emergency"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/80 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Siren className="h-4 w-4" aria-hidden />
      <span className={pathname === "/emergency" ? "underline" : undefined}>{t("shell.emergency")}</span>
    </Link>
  );

  const languageMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("shell.language")}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Languages className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">
          {LANGUAGES.find((l) => l.code === language)?.native}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => void changeLanguage(l.code)}
            className="flex items-center justify-between gap-3"
          >
            <span>{l.native}</span>
            {language === l.code && <Check className="h-4 w-4 text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const profileMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("shell.profileMenu")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-input bg-card transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        <UserRound className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="truncate">
          {me?.email ?? t("nav.profile")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.navigate({ to: "/profile" })}>
          {t("nav.profile")}
        </DropdownMenuItem>
        {me?.isAdmin && (
          <DropdownMenuItem onClick={() => router.navigate({ to: "/admin" })}>
            {t("nav.admin")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleSignOut()} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" aria-hidden />
          {t("shell.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const mobileDrawer = (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetTrigger
        aria-label={t("shell.openMenu")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-input bg-card transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <div className="border-b border-border/60 p-4">{logo}</div>
        <nav className="flex flex-col gap-1 p-3" aria-label={t("nav.menu")}>
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname.startsWith(item.to)
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4.5 w-4.5" aria-hidden />
              {t(item.key)}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4.5 w-4.5" aria-hidden />
            {t("shell.signOut")}
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
          {mobileDrawer}
          {logo}
          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label={t("nav.menu")}>
            {navItems.slice(0, 7).map((item) => (
              <Link key={item.to} to={item.to} className={navLinkClass(pathname.startsWith(item.to))}>
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {emergencyButton}
            {languageMenu}
            {profileMenu}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/60 py-4">
        <p className="mx-auto max-w-6xl px-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          {t("chat.disclaimer")}
        </p>
      </footer>
    </div>
  );
}
