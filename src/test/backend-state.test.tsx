import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n";
import type { BackendDiagnosis } from "@/lib/backend-health";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: vi.fn(),
  },
}));

const { BackendUnavailableState } = await import("@/components/backend-state");

function renderWith(diag: BackendDiagnosis) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(["backend-health"], diag);
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <BackendUnavailableState />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("BackendUnavailableState", () => {
  it("a) no URL set: explains how to set it, keeps Try again", () => {
    renderWith({ state: "unconfigured" });
    expect(screen.getByRole("heading", { name: "Nyaya Sakhi backend is not configured" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
  });

  it("b) unreachable: names the URL and lists the likely causes", () => {
    renderWith({ state: "unreachable", url: "https://api.example.org", mixedContent: false, origin: "https://app.example.org" });
    expect(screen.getByRole("heading", { name: "Cannot reach the backend" })).toBeInTheDocument();
    expect(screen.getByText("https://api.example.org")).toBeInTheDocument();
    expect(screen.getByText(/backend is not running/i)).toBeInTheDocument();
    expect(screen.getByText(/CORS_ORIGINS/)).toBeInTheDocument();
    expect(screen.getByText("https://app.example.org")).toBeInTheDocument();
    expect(screen.getByText(/served over HTTPS/)).toBeInTheDocument();
    expect(screen.getByText(/The URL is wrong/)).toBeInTheDocument();
  });

  it("c) unhealthy: marks each part from the health response", () => {
    renderWith({
      state: "unhealthy",
      url: "https://api.example.org",
      health: { status: "ok", db: false, embedding_model: true, llm_configured: false },
    });
    expect(screen.getByRole("heading", { name: "The backend is running but not ready" })).toBeInTheDocument();
    const row = (label: string) => screen.getByText(label).closest("li")!;
    expect(row("Database")).toHaveTextContent("Not ready");
    expect(row("Embedding model")).toHaveTextContent("Ready");
    expect(row("Embedding model")).not.toHaveTextContent("Not ready");
    expect(row("LLM API key")).toHaveTextContent("Not ready");
  });
});
