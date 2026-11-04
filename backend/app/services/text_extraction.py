"""Text extraction from uploaded documents (PDF or plain text)."""
from __future__ import annotations

import io


def extract_text(data: bytes, file_type: str) -> str:
    """Extract raw text. PDF first via pdfplumber, fallback to pypdf; .txt direct."""
    if file_type in ("txt", "text"):
        return data.decode("utf-8", errors="replace")
    if file_type in ("pdf", "application/pdf"):
        try:
            import pdfplumber

            with pdfplumber.open(io.BytesIO(data)) as pdf:
                pages = [(page.extract_text() or "") for page in pdf.pages]
            text = "\n\n".join(p for p in pages if p.strip())
            if text.strip():
                return text
        except Exception:
            pass  # fall through to pypdf
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(data))
            return "\n\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as exc:  # pragma: no cover - both libs failed
            raise ValueError(f"Could not extract text from PDF: {exc}") from exc
    raise ValueError(f"Unsupported file type: {file_type}")
