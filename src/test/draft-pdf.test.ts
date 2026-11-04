import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Draft-to-PDF. Text assembly is pure and unit-tested; PDF generation uses
 * jsPDF with embedded Noto fonts. Nyaya Sakhi never submits anything — the
 * review banner must always be present.
 */

vi.mock("jspdf", () => {
  class FakeDoc {
    calls: string[] = [];
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    addFileToVFS() {}
    addFont() {}
    addPage() {}
    get internal() {
      return {
        pageSize: {
          getWidth: () => 595,
          getHeight: () => 842,
        },
      };
    }
    text(line: string) {
      this.calls.push(line);
    }
    splitTextToSize(line: string) {
      return [line];
    }
    save() {}
  }
  return { jsPDF: FakeDoc };
});

import { REVIEW_BANNER, buildDraftText, downloadDraftPdf } from "@/lib/draft-pdf";

const INPUT = {
  title: "Police complaint – Test User",
  content: "To,\nThe Station House Officer\nSubject: Police complaint\n\nRespected Sir/Madam,\nI wish to report an incident.",
  language: "en" as const,
  applicantName: "Test User",
};

describe("draft-to-PDF", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fonts must be embedded, not fetched, in tests");
      }),
    );
  });

  it("always includes the review banner (never submits for the user)", () => {
    const text = buildDraftText(INPUT);
    expect(text).toContain(REVIEW_BANNER);
    expect(REVIEW_BANNER).toMatch(/never submits/i);
  });

  it("includes the drafted title, content and applicant name only", () => {
    const text = buildDraftText(INPUT);
    expect(text).toContain("POLICE COMPLAINT – TEST USER");
    expect(text).toContain("I wish to report an incident.");
    expect(text).toContain("Applicant: Test User");
  });

  it("marks the document as prepared by Nyaya Sakhi, for literacy not advice", () => {
    const text = buildDraftText(INPUT);
    expect(text).toMatch(/legal literacy, not legal advice/i);
  });

  it("generates a PDF for English without fetching any font", async () => {
    await expect(downloadDraftPdf(INPUT)).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("embeds a Noto font for Hindi and Kannada drafts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new ArrayBuffer(8), { status: 200 })),
    );
    await expect(downloadDraftPdf({ ...INPUT, language: "kn" })).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(downloadDraftPdf({ ...INPUT, language: "hi" })).resolves.toBeUndefined();
  });
});
