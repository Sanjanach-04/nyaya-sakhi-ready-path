import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE_OVERRIDE_KEY,
  getApiBaseUrl,
  setApiBaseOverride,
  validateBackendUrl,
} from "@/lib/backend-config";
import { diagnoseBackend } from "@/lib/backend-health";

const ORIGINAL = import.meta.env["VITE_API_BASE_URL"];
const setEnv = (v: string) => {
  (import.meta.env as Record<string, unknown>)["VITE_API_BASE_URL"] = v;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("backend URL rules", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setEnv("");
  });
  afterEach(() => setEnv(ORIGINAL ?? ""));

  it("accepts https URLs and strips the trailing slash", () => {
    expect(validateBackendUrl("https://api.example.org/")).toEqual({ ok: true, url: "https://api.example.org" });
  });

  it("accepts http://localhost with a port", () => {
    expect(validateBackendUrl("http://localhost:8000")).toEqual({ ok: true, url: "http://localhost:8000" });
  });

  it("rejects plain http on other hosts", () => {
    expect(validateBackendUrl("http://api.example.org").ok).toBe(false);
    expect(validateBackendUrl("http://192.168.1.5:8000").ok).toBe(false);
  });

  it("rejects non-http schemes and URLs with credentials", () => {
    expect(validateBackendUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateBackendUrl("https://user:pw@api.example.org").ok).toBe(false);
    expect(validateBackendUrl("not a url").ok).toBe(false);
  });

  it("uses the saved override only when VITE_API_BASE_URL is missing", () => {
    setApiBaseOverride("https://override.example.org");
    expect(getApiBaseUrl()).toBe("https://override.example.org");
    setEnv("https://env.example.org");
    expect(getApiBaseUrl()).toBe("https://env.example.org");
  });

  it("ignores a tampered override that is not https/localhost", () => {
    window.localStorage.setItem(API_BASE_OVERRIDE_KEY, "http://evil.example.org");
    expect(getApiBaseUrl()).toBe("");
  });
});

describe("diagnoseBackend", () => {
  it("reports unconfigured without fetching when no URL is set", async () => {
    const f = vi.fn();
    await expect(diagnoseBackend("", f)).resolves.toEqual({ state: "unconfigured" });
    expect(f).not.toHaveBeenCalled();
  });

  it("calls GET {base}/api/health", async () => {
    const f = vi.fn(async () => json({ status: "ok", db: true, embedding_model: true, llm_configured: true }));
    const d = await diagnoseBackend("https://api.example.org", f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledWith("https://api.example.org/api/health", expect.objectContaining({ method: "GET" }));
    expect(d.state).toBe("ok");
  });

  it("reports unreachable with the URL on network failure", async () => {
    const f = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const d = await diagnoseBackend("https://api.example.org", f as unknown as typeof fetch);
    expect(d).toMatchObject({ state: "unreachable", url: "https://api.example.org" });
  });

  it("reports unreachable with the status when /api/health is missing (404)", async () => {
    const f = vi.fn(async () => json({ detail: "Not Found" }, 404));
    const d = await diagnoseBackend("https://api.example.org", f as unknown as typeof fetch);
    expect(d).toMatchObject({ state: "unreachable", httpStatus: 404 });
  });

  it("reports unhealthy with the exact parts that are not ready", async () => {
    const f = vi.fn(async () => json({ status: "ok", db: false, embedding_model: true, llm_configured: false }));
    const d = await diagnoseBackend("https://api.example.org", f as unknown as typeof fetch);
    expect(d.state).toBe("unhealthy");
    if (d.state === "unhealthy") {
      expect(d.health.db).toBe(false);
      expect(d.health.embedding_model).toBe(true);
      expect(d.health.llm_configured).toBe(false);
    }
  });
});
