/**
 * Typed REST client for the Nyaya Sakhi FastAPI backend.
 *
 * Architecture rule: ALL app logic (chat/RAG, legal, schemes, complaints,
 * legal aid, emergency, speech, translation, admin) lives in the FastAPI
 * backend in /backend. This client is the ONLY way the frontend talks to it.
 * Supabase is used only for authentication and direct reads of
 * auth/profile/role rows.
 *
 * There are no mock or fallback responses anywhere in this file. If the
 * backend is not configured (VITE_API_BASE_URL missing) or unreachable, every
 * call rejects with an ApiError whose `kind` is "unconfigured" or
 * "unreachable"; pages render a clear setup state for those.
 */
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getApiBaseUrl } from "@/lib/backend-config";

/** Current backend base URL: VITE_API_BASE_URL, else a saved browser override. */
export { getApiBaseUrl };

export function isBackendConfigured(): boolean {
  return !!getApiBaseUrl();
}

export type ApiErrorKind =
  | "unconfigured" // VITE_API_BASE_URL not set
  | "unreachable" // network failure / backend down
  | "auth" // 401
  | "forbidden" // 403
  | "validation" // 422
  | "server" // 5xx
  | "request"; // other 4xx

export class ApiError extends Error {
  kind: ApiErrorKind;
  status: number | undefined;
  detail?: unknown;

  constructor(kind: ApiErrorKind, message: string, status?: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

/** True when the error means "show the backend setup state instead of a failure". */
export function isBackendStateError(error: unknown): boolean {
  // 5xx is included so pages show the health diagnostics (e.g. database not
  // ready) instead of an empty list.
  return (
    error instanceof ApiError &&
    (error.kind === "unconfigured" || error.kind === "unreachable" || error.kind === "server")
  );
}

const KIND_TOAST: Record<ApiErrorKind, string | null> = {
  unconfigured: null, // pages show a full setup state instead
  unreachable: null, // pages show a setup/unreachable state instead
  auth: "Your session expired. Please sign in again.",
  forbidden: "You don't have permission for that action.",
  validation: null, // 422 detail is surfaced by the caller
  server: "The Nyaya Sakhi service had a problem. Please try again.",
  request: null,
};

export interface ApiErrorBody {
  detail?: string | { msg?: string; loc?: unknown[] };
  message?: string;
}

function messageFromBody(body: ApiErrorBody | null, fallback: string): string {
  if (!body) return fallback;
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) {
    const first = body.detail.find((d) => typeof d?.msg === "string");
    if (first && typeof first.msg === "string") {
      return first.msg.replace(/^Value error,\s*/i, "");
    }
  }
  if (body.detail && typeof body.detail === "object" && typeof body.detail.msg === "string") {
    return body.detail.msg;
  }
  if (typeof body.message === "string") return body.message;
  return fallback;
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: ApiMethod;
  body?: unknown;
  /** Skip attaching the Supabase bearer token (public endpoints). */
  anonymous?: boolean;
  /** Suppress the automatic toast for handled errors. */
  silent?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, anonymous = false, silent = false } = options;

  const API_BASE_URL = getApiBaseUrl();
  if (!API_BASE_URL) {
    const err = new ApiError(
      "unconfigured",
      "Backend not configured. Set VITE_API_BASE_URL to the Nyaya Sakhi backend URL and rebuild the app.",
    );
    throw err;
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  const isMultipart = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isMultipart) headers["Content-Type"] = "application/json";

  if (!anonymous) {
    const token = await getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = isMultipart ? (body as FormData) : JSON.stringify(body);

  try {
    res = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    const err = new ApiError(
      "unreachable",
      `Cannot reach the backend at ${API_BASE_URL}. Check that it is running and allows this site in CORS_ORIGINS.`,
    );
    if (!silent) toast.error(err.message);
    throw err;
  }

  if (res.status === 204) return undefined as T;

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const body = (parsed ?? null) as ApiErrorBody | null;
    const kind: ApiErrorKind =
      res.status === 401
        ? "auth"
        : res.status === 403
          ? "forbidden"
          : res.status === 422
            ? "validation"
            : res.status >= 500
              ? "server"
              : "request";
    const message = messageFromBody(body, `Request failed (${res.status}).`);
    const err = new ApiError(kind, message, res.status, parsed);
    const toastText = KIND_TOAST[kind];
    if (!silent && toastText) toast.error(toastText);
    if (!silent && kind === "validation" && message !== "Validation error") toast.error(message);
    throw err;
  }

  return parsed as T;
}

// ---------------------------------------------------------------------------
// Shared response types (mirror backend/app/schemas)
// ---------------------------------------------------------------------------

export interface Citation {
  chunk_id: string;
  act: string;
  section: string | null;
  section_title: string | null;
  document_title: string;
  document_version: string;
  is_demo: boolean;
  similarity: number;
  snippet?: string;
}

export interface NextStepOption {
  label: string;
  description: string;
  link: string;
}

export interface ChatAnswer {
  session_id: string;
  message_id: string | null;
  refused: boolean;
  refusal_reason: string | null;
  explanation: string;
  act_name: string | null;
  section_number: string | null;
  citations: Citation[];
  disclaimer: string;
  next_steps: NextStepOption[];
  language: string;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  citations: ChatAnswer["citations"] | Record<string, never>;
  refused?: boolean;
  created_at: string;
}

export interface ChatThread {
  session: ChatSessionSummary;
  messages: ChatMessage[];
}

export interface LegalActSummary {
  id: string;
  title: string;
  act_name: string;
  category: string;
  description: string | null;
  summary: string | null;
  version: string;
  language: string;
  is_demo: boolean;
  updated_at: string;
}

export interface LegalActDetail extends LegalActSummary {
  source_title: string | null;
  source_url: string | null;
  source_version: string | null;
  provisions: LegalProvision[];
}

export interface LegalProvision {
  chunk_id: string;
  act_name: string;
  section_number: string | null;
  section_title: string | null;
  content: string;
  plain_explanation: string | null;
}

export interface Scheme {
  id: string;
  name: string;
  description: string;
  department: string;
  level: "central" | "state";
  state_name: string | null;
  category: string;
  beneficiaries: string | null;
  eligibility: SchemeEligibilityRule[];
  benefits: string | null;
  required_documents: string | null;
  application_process: string | null;
  official_url: string | null;
  source_reference: string;
  last_verified_date: string | null;
  is_demo: boolean;
}

export interface SchemeEligibilityRule {
  field: string;
  values?: string[];
  min?: number;
  max?: number;
  note?: string;
}

export type EligibilityBucket = "potentially_eligible" | "needs_verification" | "not_matching";

export interface EligibilityResult {
  scheme_id: string;
  name: string;
  bucket: EligibilityBucket;
  reason: string;
}

export interface EligibilityRecommendation {
  results: EligibilityResult[];
  potentially_eligible: EligibilityResult[];
  needs_verification: EligibilityResult[];
  not_matching: EligibilityResult[];
  disclaimer: string;
}

export interface ComplaintDraft {
  id: string;
  document_type: string;
  title: string;
  form_data: Record<string, unknown>;
  draft_content: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface ComplaintTemplateField {
  key: string;
  label: string;
  required: boolean;
  multiline?: boolean;
  /** Field belongs to the personal/recipient details step of the drafter. */
  personal?: boolean;
  placeholder?: string;
}

export interface ComplaintTemplate {
  type: string;
  title: string;
  description: string;
  fields: ComplaintTemplateField[];
}

export interface LegalAidAuthority {
  id: string;
  name: string;
  level: "national" | "state" | "district";
  state: string | null;
  district: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  source_reference: string;
  last_verified_date: string | null;
  is_demo: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  purpose: string;
  phone_number: string;
  availability: string | null;
  category: string;
  is_demo: boolean;
  source_reference: string;
  display_order: number;
}

export interface SavedItem {
  id: string;
  item_type: "act" | "scheme" | "chat_message";
  ref_id: string | null;
  title: string;
  note: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  preferred_language: "en" | "hi" | "kn";
  created_at: string;
}

export interface AdminDocument {
  id: string;
  title: string;
  act_name: string;
  category: string;
  description: string | null;
  summary: string | null;
  status: "pending" | "approved" | "rejected";
  version: string;
  language: string;
  file_path: string | null;
  is_demo: boolean;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminStats {
  users: number;
  chat_sessions: number;
  chat_messages: number;
  drafts: number;
  refusals: number;
  questions: number;
  approved_documents: number;
  pending_documents: number;
  schemes: number;
}

export interface IngestionJob {
  id: string;
  document_id: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  error: string | null;
  chunks_created: number;
  embeddings_created: number;
  pages_processed: number;
  created_at: string;
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// Endpoint helpers (grouped per module)
// ---------------------------------------------------------------------------

export const api = {
  auth: {
    getProfile: () => apiFetch<UserProfile>("/api/auth/profile"),
    updateProfile: (patch: { display_name?: string; preferred_language?: string }) =>
      apiFetch<UserProfile>("/api/auth/profile", { method: "PUT", body: patch }),
  },
  chat: {
    ask: (body: { question: string; language?: string; session_id?: string | null }) =>
      apiFetch<ChatAnswer>("/api/chat/ask", { method: "POST", body }),
    history: () => apiFetch<ChatSessionSummary[]>("/api/chat/history"),
    thread: (id: string) => apiFetch<ChatThread>(`/api/chat/history/${id}`),
    deleteThread: (id: string) => apiFetch<void>(`/api/chat/history/${id}`, { method: "DELETE" }),
    deleteAll: () => apiFetch<void>("/api/chat/history", { method: "DELETE" }),
  },
  legal: {
    acts: () => apiFetch<LegalActSummary[]>("/api/legal/acts"),
    act: (id: string) => apiFetch<LegalActDetail>(`/api/legal/acts/${id}`),
    search: (q: string) =>
      apiFetch<LegalActSummary[]>(`/api/legal/search?q=${encodeURIComponent(q)}`),
  },
  schemes: {
    list: () => apiFetch<Scheme[]>("/api/schemes"),
    get: (id: string) => apiFetch<Scheme>(`/api/schemes/${id}`),
    recommend: (body: Record<string, string>) =>
      apiFetch<EligibilityRecommendation>("/api/schemes/recommend", { method: "POST", body }),
  },
  complaints: {
    templates: () => apiFetch<ComplaintTemplate[]>("/api/complaints/templates"),
    generate: (body: { document_type: string; fields: Record<string, string>; language?: string }) =>
      apiFetch<{ draft_content: string; title: string }>(
        "/api/complaints/generate",
        { method: "POST", body },
      ),
    list: () => apiFetch<ComplaintDraft[]>("/api/complaints"),
    create: (body: { document_type: string; title: string; form_data: Record<string, unknown>; draft_content: string; language?: string }) =>
      apiFetch<ComplaintDraft>("/api/complaints", { method: "POST", body }),
    get: (id: string) => apiFetch<ComplaintDraft>(`/api/complaints/${id}`),
    update: (id: string, body: { title?: string; draft_content?: string; form_data?: Record<string, unknown> }) =>
      apiFetch<ComplaintDraft>(`/api/complaints/${id}`, { method: "PUT", body }),
    remove: (id: string) => apiFetch<void>(`/api/complaints/${id}`, { method: "DELETE" }),
  },
  legalAid: {
    list: () => apiFetch<LegalAidAuthority[]>("/api/legal-aid"),
  },
  emergency: {
    list: () => apiFetch<EmergencyContact[]>("/api/emergency"),
  },
  speech: {
    stt: (form: FormData) =>
      apiFetch<{ text: string }>(
        "/api/speech/stt",
        { method: "POST", body: form as unknown as Record<string, unknown>, silent: true },
      ),
    tts: (body: { text: string; language?: string }) =>
      apiFetch<{ audio_base64: string; media_type: string }>("/api/speech/tts", {
        method: "POST",
        body,
        silent: true,
      }),
  },
  saved: {
    list: () => apiFetch<SavedItem[]>("/api/saved"),
    create: (body: { item_type: string; ref_id?: string | null; title: string; note?: string | null }) =>
      apiFetch<SavedItem>("/api/saved", { method: "POST", body }),
    remove: (id: string) => apiFetch<void>(`/api/saved/${id}`, { method: "DELETE" }),
  },
  admin: {
    documents: () => apiFetch<AdminDocument[]>("/api/admin/documents"),
    upload: (form: FormData) =>
      apiFetch<AdminDocument>("/api/admin/documents/upload", {
        method: "POST",
        body: form as unknown as Record<string, unknown>,
      }),
    process: (id: string) =>
      apiFetch<IngestionJob>(`/api/admin/documents/${id}/process`, { method: "POST", body: {} }),
    approve: (id: string) =>
      apiFetch<AdminDocument>(`/api/admin/documents/${id}/approve`, { method: "POST", body: {} }),
    reject: (id: string) =>
      apiFetch<AdminDocument>(`/api/admin/documents/${id}/reject`, { method: "POST", body: {} }),
    replaceVersion: (id: string, form: FormData) =>
      apiFetch<AdminDocument>(`/api/admin/documents/${id}/replace-version`, {
        method: "POST",
        body: form as unknown as Record<string, unknown>,
      }),
    createScheme: (body: unknown) =>
      apiFetch<Scheme>("/api/admin/schemes", { method: "POST", body }),
    updateScheme: (id: string, body: unknown) =>
      apiFetch<Scheme>(`/api/admin/schemes/${id}`, { method: "PUT", body }),
    markSchemeVerified: (id: string) =>
      apiFetch<Scheme>(`/api/admin/schemes/${id}/verify`, { method: "POST", body: {} }),
    deleteScheme: (id: string) => apiFetch<void>(`/api/admin/schemes/${id}`, { method: "DELETE" }),
    emergencyCreate: (body: unknown) =>
      apiFetch<EmergencyContact>("/api/admin/emergency", { method: "POST", body }),
    emergencyUpdate: (id: string, body: unknown) =>
      apiFetch<EmergencyContact>(`/api/admin/emergency/${id}`, { method: "PUT", body }),
    emergencyDelete: (id: string) =>
      apiFetch<void>(`/api/admin/emergency/${id}`, { method: "DELETE" }),
    legalAidCreate: (body: unknown) =>
      apiFetch<LegalAidAuthority>("/api/admin/legal-aid", { method: "POST", body }),
    legalAidUpdate: (id: string, body: unknown) =>
      apiFetch<LegalAidAuthority>(`/api/admin/legal-aid/${id}`, { method: "PUT", body }),
    legalAidDelete: (id: string) =>
      apiFetch<void>(`/api/admin/legal-aid/${id}`, { method: "DELETE" }),
    stats: () => apiFetch<AdminStats>("/api/admin/stats"),
    jobs: () => apiFetch<IngestionJob[]>("/api/admin/jobs"),
  },
};
