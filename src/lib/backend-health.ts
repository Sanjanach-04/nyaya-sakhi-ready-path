/**
 * Backend health diagnostics: GET {API_BASE}/api/health (no auth).
 * Classifies the connection as unconfigured / unreachable / unhealthy / ok.
 * Never fabricates data — it only reports what the backend says.
 */
import { queryOptions } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/backend-config";

export interface BackendHealth {
  status: string;
  db: boolean;
  embedding_model: boolean;
  llm_configured: boolean;
}

export type BackendDiagnosis =
  | { state: "unconfigured" }
  | {
      state: "unreachable";
      url: string;
      /** HTTPS page calling an http:// (non-localhost) URL. */
      mixedContent: boolean;
      /** Set when the server answered but /api/health was not a valid response. */
      httpStatus?: number;
      origin: string;
    }
  | { state: "unhealthy"; url: string; health: BackendHealth }
  | { state: "ok"; url: string; health: BackendHealth };

const HEALTH_TIMEOUT_MS = 8000;

function isHealthBody(value: unknown): value is BackendHealth {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.status === "string" &&
    typeof v.db === "boolean" &&
    typeof v.embedding_model === "boolean" &&
    typeof v.llm_configured === "boolean"
  );
}

export function isHealthy(h: BackendHealth): boolean {
  return h.status === "ok" && h.db && h.embedding_model && h.llm_configured;
}

export async function diagnoseBackend(
  baseUrl: string = getApiBaseUrl(),
  fetchImpl: typeof fetch = fetch,
): Promise<BackendDiagnosis> {
  if (!baseUrl) return { state: "unconfigured" };

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const pageIsHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  let mixedContent = false;
  try {
    const u = new URL(baseUrl);
    mixedContent = pageIsHttps && u.protocol === "http:" && u.hostname !== "localhost";
  } catch {
    // An invalid URL simply fails to fetch below.
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl}/api/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch {
    return { state: "unreachable", url: baseUrl, mixedContent, origin };
  } finally {
    clearTimeout(timer);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok || !isHealthBody(body)) {
    return { state: "unreachable", url: baseUrl, mixedContent, origin, httpStatus: res.status };
  }
  return isHealthy(body)
    ? { state: "ok", url: baseUrl, health: body }
    : { state: "unhealthy", url: baseUrl, health: body };
}

export const backendHealthQuery = () =>
  queryOptions({
    queryKey: ["backend-health"],
    queryFn: () => diagnoseBackend(),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
