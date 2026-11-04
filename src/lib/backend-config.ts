/**
 * Where the FastAPI backend lives.
 *
 * Order: VITE_API_BASE_URL (build-time) wins. Only when it is missing, a
 * browser-local override saved from the "Backend connection" dialog is used.
 * Overrides must be https:// or http://localhost because the Supabase login
 * token is sent to this address with every request.
 */

export const API_BASE_OVERRIDE_KEY = "nyaya-sakhi-api-base-override";

function stripSlash(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Build-time URL from VITE_API_BASE_URL ("" when unset). */
export function getEnvApiBaseUrl(): string {
  return stripSlash((import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "");
}

export type BackendUrlValidation = { ok: true; url: string } | { ok: false };

/** Accept only https:// URLs, or http://localhost (any port). No credentials. */
export function validateBackendUrl(raw: string): BackendUrlValidation {
  const value = raw.trim();
  if (!value) return { ok: false };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false };
  }
  if (parsed.username || parsed.password) return { ok: false };
  if (parsed.search || parsed.hash) return { ok: false };
  const isHttps = parsed.protocol === "https:";
  const isLocalHttp = parsed.protocol === "http:" && parsed.hostname === "localhost";
  if (!isHttps && !isLocalHttp) return { ok: false };
  return { ok: true, url: stripSlash(`${parsed.origin}${parsed.pathname}`) };
}

/** Saved override, re-validated on every read ("" when none / invalid). */
export function getApiBaseOverride(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem(API_BASE_OVERRIDE_KEY) ?? "";
    const result = validateBackendUrl(stored);
    return result.ok ? result.url : "";
  } catch {
    return "";
  }
}

export function setApiBaseOverride(url: string | null): void {
  if (typeof window === "undefined") return;
  if (url === null) {
    window.localStorage.removeItem(API_BASE_OVERRIDE_KEY);
    return;
  }
  const result = validateBackendUrl(url);
  if (!result.ok) throw new Error("Invalid backend URL");
  window.localStorage.setItem(API_BASE_OVERRIDE_KEY, result.url);
}

/** The URL the API client calls ("" = not configured). */
export function getApiBaseUrl(): string {
  return getEnvApiBaseUrl() || getApiBaseOverride();
}

/**
 * True in development builds and on Lovable preview hosts. The connection
 * dialog is offered here and to admins only. Call after hydration.
 */
export function isDevOrPreviewBuild(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("id-preview--") ||
    host.endsWith("-dev.lovable.app") ||
    host.endsWith(".lovableproject.com")
  );
}
