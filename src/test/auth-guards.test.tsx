import { createRouter, rootRouteId } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

/**
 * Route guard checks. The _authenticated pathless layout owns the session
 * gate; /admin and /profile must live inside it, and / (landing) must stay
 * public so signed-out visitors can reach it.
 */
describe("auth guards", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it("matches /dashboard under the _authenticated layout", () => {
    const matches = router.matchRoutes("/dashboard");
    const ids = matches.map((m) => m.routeId);
    expect(ids).toContain("/_authenticated");
    expect(ids).toContain("/_authenticated/dashboard");
  });

  it("matches /admin under the _authenticated layout (role-gated UI lives on the page)", () => {
    const ids = router.matchRoutes("/admin").map((m) => m.routeId);
    expect(ids).toContain("/_authenticated");
    expect(ids).toContain("/_authenticated/admin");
  });

  it("matches /profile under the _authenticated layout", () => {
    const ids = router.matchRoutes("/profile").map((m) => m.routeId);
    expect(ids).toContain("/_authenticated/profile");
  });

  it("keeps / public (no _authenticated match)", () => {
    const matches = router.matchRoutes("/");
    const ids = matches.map((m) => m.routeId);
    expect(ids).not.toContain("/_authenticated");
    expect(ids.at(-1)).not.toBe(rootRouteId);
  });
});
