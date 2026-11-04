/**
 * Draft-to-PDF for complaint/application drafts.
 *
 * Pure text assembly lives in buildDraftText (unit-tested). PDF generation
 * uses jsPDF; Noto Sans Devanagari and Noto Sans Kannada fonts are embedded
 * from /fonts so Hindi and Kannada drafts export correctly. Fonts are loaded
 * lazily from a user action (download click) — never at module scope.
 */
import { jsPDF } from "jspdf";

export type DraftLanguage = "en" | "hi" | "kn";

export interface DraftPdfInput {
  title: string;
  content: string;
  language: DraftLanguage;
  applicantName?: string;
}

export const REVIEW_BANNER =
  "REVIEW BEFORE SUBMITTING. Nyaya Sakhi never submits anything for you. This draft was prepared with your own details only.";

const FONT_FILES: Record<"hi" | "kn", { file: string; name: string; style: string }> = {
  hi: { file: "/fonts/NotoSansDevanagari-Regular.ttf", name: "NotoSansDevanagari", style: "normal" },
  kn: { file: "/fonts/NotoSansKannada-Regular.ttf", name: "NotoSansKannada", style: "normal" },
};

/** Pure assembly of the printable draft text (tested). */
export function buildDraftText(input: DraftPdfInput): string {
  const lines: string[] = [];
  lines.push(REVIEW_BANNER);
  lines.push("");
  lines.push(input.title.toUpperCase());
  lines.push("=".repeat(Math.max(input.title.length, 12)));
  lines.push("");
  lines.push(input.content.trim());
  lines.push("");
  lines.push("-".repeat(40));
  if (input.applicantName) {
    lines.push(`Applicant: ${input.applicantName}`);
  }
  lines.push("Prepared with Nyaya Sakhi (nyaya-sakhi) — for legal literacy, not legal advice.");
  lines.push("Verify every detail before you submit this document yourself.");
  return lines.join("\n");
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const fontCache = new Map<string, string>();

async function loadFont(kind: "hi" | "kn"): Promise<{ base64: string; name: string }> {
  const spec = FONT_FILES[kind];
  const cached = fontCache.get(kind);
  if (cached) return { base64: cached, name: spec.name };
  const res = await fetch(spec.file);
  if (!res.ok) throw new Error("Draft font missing");
  const base64 = toBase64(await res.arrayBuffer());
  fontCache.set(kind, base64);
  return { base64, name: spec.name };
}

export async function downloadDraftPdf(input: DraftPdfInput): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const width = doc.internal.pageSize.getWidth() - margin * 2;

  if (input.language === "hi" || input.language === "kn") {
    const font = await loadFont(input.language);
    doc.addFileToVFS(`${font.name}.ttf`, font.base64);
    doc.addFont(`${font.name}.ttf`, font.name, FONT_FILES[input.language].style);
    doc.setFont(font.name, "normal");
  } else {
    doc.setFont("helvetica", "normal");
  }

  const text = buildDraftText(input);
  const lines = doc.splitTextToSize(text, width) as string[];
  let y = margin;
  const lineHeight = 15;
  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
      if (input.language === "hi" || input.language === "kn") {
        doc.setFont(FONT_FILES[input.language].name, "normal");
      } else {
        doc.setFont("helvetica", "normal");
      }
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }

  doc.save(`nyaya-sakhi-${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "draft"}.pdf`);
}
