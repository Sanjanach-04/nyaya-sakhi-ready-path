import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
