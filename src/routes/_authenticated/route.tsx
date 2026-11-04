import { createFileRoute, redirect } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Auth gate for PRIVATE pages only (history, profile, admin, saved chat
// threads). Public pages (dashboard, chat, rights, schemes, drafter, legal
// aid, emergency) live at the top level and work for guests.
// Client-only session check (the session lives in browser storage, which the
// server cannot read). The blocked URL is passed to /auth so the user comes
// back to the same page after signing in.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth", search: { mode: "signin", redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
