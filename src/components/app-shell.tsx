import * as React from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, Scale, Siren, LogOut, UserRound, Languages, Check, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, LANGUAGES, type LanguageCode } from "@/i18n";
import { NAV_ITEMS } from "@/lib/nav";
import { useMyRoles } from "@/hooks/use-my-roles";
import {
  BackendConnectionDialog,
  ConnectionDot,
  ConnectionStatusLabel,
  connectionTone,
  useBackendHealth,
  useCanConfigureBackend,
} from "@/components/backend-connection";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export { useMyRoles };

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, language, setLanguage } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: me } = useMyRoles();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [connectionOpen, setConnectionOpen] = React.useState(false);
  // Health check on app load; "Try again" anywhere re-runs it.
  const health = useBackendHealth();
  const tone = health.isFetching && !health.data ? "checking" : connectionTone(health.data);
  const canConfigureBackend = useCanConfigureBackend();

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
    <Link to="/dashboard" aria-label={t("app.name")} className="flex min-w-0 shrink-0 items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground sm:h-10 sm:w-10">
        <Scale className="h-5 w-5" aria-hidden />
      </span>
      <span className="hidden flex-col sm:flex">
        <span className="whitespace-nowrap font-display text-xl leading-none">{t("app.name")}</span>
        <span className="mt-0.5 hidden whitespace-nowrap font-sans text-[10px] font-medium leading-none tracking-wide text-muted-foreground xl:block">
          {t("app.tagline")}
        </span>
      </span>
    </Link>
  );

  const drawerLogo = (
    <Link to="/dashboard" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Scale className="h-5 w-5" aria-hidden />
      </span>
      <span className="flex flex-col">
        <span className="whitespace-nowrap font-display text-xl leading-none">{t("app.name")}</span>
        <span className="mt-1 whitespace-nowrap font-sans text-[10px] font-medium leading-none tracking-wide text-muted-foreground">
          {t("app.tagline")}
        </span>
      </span>
    </Link>
  );

  const navLinkClass = (active: boolean) =>
    `whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
      active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
    }`;

  const emergencyButton = (
    <Link
      to="/emergency"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/80 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Siren className="h-4 w-4" aria-hidden />
      <span className={pathname === "/emergency" ? "underline" : undefined}>{t("shell.emergency")}</span>
    </Link>
  );

  const languageMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("shell.language")}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-input bg-card px-2.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
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
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-input bg-card transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        <UserRound className="h-4 w-4" aria-hidden />
        <ConnectionDot tone={tone} className="absolute -right-0.5 -top-0.5 ring-2 ring-background" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="truncate">
          {me?.email ?? t("nav.profile")}
        </DropdownMenuLabel>
        <div className="px-2 pb-1.5">
          <ConnectionStatusLabel />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.navigate({ to: "/profile" })}>
          {t("nav.profile")}
        </DropdownMenuItem>
        {me?.isAdmin && (
          <DropdownMenuItem onClick={() => router.navigate({ to: "/admin" })}>
            {t("nav.admin")}
          </DropdownMenuItem>
        )}
        {canConfigureBackend && (
          <DropdownMenuItem onSelect={() => setConnectionOpen(true)}>
            <PlugZap className="h-4 w-4" aria-hidden />
            {t("conn.menuItem")}
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
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-input bg-card transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <div className="border-b border-border/60 p-4">{drawerLogo}</div>
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
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:px-4">
          {mobileDrawer}
          {logo}
          <nav className="ml-2 hidden min-w-0 items-center gap-0.5 lg:flex xl:ml-4" aria-label={t("nav.menu")}>
            {navItems.slice(0, 7).map((item) => (
              <Link key={item.to} to={item.to} className={navLinkClass(pathname.startsWith(item.to))}>
                {t(item.shortKey ?? item.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {emergencyButton}
            {languageMenu}
            {profileMenu}
          </div>
        </div>
      </header>
      {canConfigureBackend && (
        <BackendConnectionDialog open={connectionOpen} onOpenChange={setConnectionOpen} />
      )}
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/60 py-4">
        <p className="mx-auto max-w-6xl px-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          {t("chat.disclaimer")}
        </p>
      </footer>
    </div>
  );
}
