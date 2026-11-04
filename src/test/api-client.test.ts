import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiError } from "@/lib/api";

/**
 * API client error handling. The client reads VITE_API_BASE_URL and the
 * Supabase bearer token; both are stubbed per test.
 */
const ORIGINAL_ENV = { ...import.meta.env };

const setApiBase = (value: string | undefined) => {
  // api.ts reads the value at module scope, so re-import it fresh per case.
  // import.meta.env stores strings, so "unset" is simulated with "".
  vi.resetModules();
  (import.meta.env as Record<string, unknown>)["VITE_API_BASE_URL"] = value ?? "";
};

const loadClient = async () => await import("@/lib/api");

// Stub the supabase client module before importing @/lib/api.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "test-token" } },
      })),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("api client", () => {
  beforeEach(() => {
    (import.meta.env as Record<string, unknown>)["VITE_API_BASE_URL"] = ORIGINAL_ENV["VITE_API_BASE_URL"];
  });

  it("rejects with kind 'unconfigured' and never fetches when VITE_API_BASE_URL is unset", async () => {
    setApiBase(undefined);
    const { apiFetch, ApiError: ApiErrorClass } = await loadClient();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(apiFetch("/api/schemes")).rejects.toMatchObject({ kind: "unconfigured" });
    await expect(apiFetch("/api/schemes")).rejects.toBeInstanceOf(ApiErrorClass);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("attaches the Supabase bearer token and surfaces 422 details", async () => {
    setApiBase("http://localhost:9999");
    const { apiFetch, ApiError: ApiErrorClass } = await loadClient();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: "Missing required details: Your full name" }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const promise = apiFetch("/api/complaints/generate", { method: "POST", body: {} });
    await expect(promise).rejects.toBeInstanceOf(ApiErrorClass);
    try {
      await apiFetch("/api/complaints/generate", { method: "POST", body: {} });
    } catch (err) {
      expect((err as ApiError).kind).toBe("validation");
      expect((err as ApiError).message).toContain("Missing required details");
      expect((err as ApiError).status).toBe(422);
    }

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer test-token");
  });

  it("marks network failures as 'unreachable'", async () => {
    setApiBase("http://localhost:9999");
    const { apiFetch, ApiError: ApiErrorClass } = await loadClient();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Network failure"); }));

    await expect(apiFetch("/api/emergency", { silent: true })).rejects.toMatchObject({
      kind: "unreachable",
    });
    await expect(apiFetch("/api/emergency", { silent: true })).rejects.toBeInstanceOf(ApiErrorClass);
  });

  it("maps 403 to 'forbidden'", async () => {
    setApiBase("http://localhost:9999");
    const { apiFetch, ApiError: ApiErrorClass } = await loadClient();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ detail: "Admin role required" }), { status: 403 })),
    );

    try {
      await apiFetch("/api/admin/documents", { silent: true });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiErrorClass);
      expect((err as ApiError).kind).toBe("forbidden");
    }
  });
});
