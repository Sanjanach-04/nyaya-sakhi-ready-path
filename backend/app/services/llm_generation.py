"""LLM generation, provider-agnostic (OpenAI-compatible chat completions).

The prompt contains ONLY retrieved chunks. The model must answer strictly from
context and return JSON. It never receives or is allowed to invent outside
legal content.
"""
from __future__ import annotations

import json
import logging

import httpx

from app.core.config import settings
from app.services.vector_search import RetrievedChunk

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Nyaya Sakhi, a legal literacy assistant for women in India.
You will receive VERIFIED legal text chunks retrieved from an approved knowledge base, and a user question.

STRICT RULES:
1. Answer ONLY using information contained in the provided chunks.
2. Never use outside knowledge. Never invent Acts, sections, court cases, amendments, schemes or numbers.
3. If the chunks do not contain enough information to answer, respond with {"refused": true, "explanation": "I couldn't find sufficient verified information in my legal knowledge base to answer this question reliably. Please consult NALSA, your State Legal Services Authority or a qualified lawyer.", "citations": []}.
4. Reply with a JSON object ONLY (no markdown, no code fences):
{
  "explanation": "<plain-language explanation, short paragraphs>",
  "citations": [{"chunk_id": "<id of the chunk you used>", "act": "<act name from that chunk>", "section": "<section number from that chunk, or null>"}],
  "refused": false
}
5. Cite only chunk_ids that appear in the provided chunks. The 'act' and 'section' values must be copied from the cited chunk's metadata.
"""


def _build_context(chunks: list[RetrievedChunk]) -> str:
    parts = []
    for c in chunks:
        header = f"chunk_id={c.chunk_id} | act={c.act_name} | version={c.document_version}"
        if c.section_number:
            header += f" | section={c.section_number}"
        parts.append(f"[{header}]\n{c.content}")
    return "\n\n---\n\n".join(parts)


class LLMNotConfigured(RuntimeError):
    """Raised when LLM_BASE_URL / LLM_API_KEY / LLM_MODEL are missing."""


def generate_answer(question: str, chunks: list[RetrievedChunk]) -> dict:
    """Call the configured LLM with only the retrieved context. Returns parsed JSON.

    Raises LLMNotConfigured when the provider is missing and ValueError when the
    model returns unparseable output.
    """
    if not settings.llm_configured:
        raise LLMNotConfigured(
            "LLM is not configured. Set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL in backend/.env."
        )
    body = {
        "model": settings.LLM_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Verified legal chunks from the approved knowledge base:\n\n"
                    f"{_build_context(chunks)}\n\n---\n\nUser question:\n{question}"
                ),
            },
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": 1200,
    }
    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    url = settings.LLM_BASE_URL.rstrip("/")
    if not url.endswith("/chat/completions"):
        url = f"{url}/chat/completions"
    with httpx.Client(timeout=90) as client:
        res = client.post(url, json=body, headers=headers)
        if res.status_code >= 400:
            logger.warning("LLM call failed: %s %s", res.status_code, res.text[:500])
            raise ValueError(f"LLM provider error {res.status_code}")
        payload = res.json()
    content = payload["choices"][0]["message"]["content"]
    return _parse_json(content)


def _parse_json(content: str) -> dict:
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM returned non-JSON output: {text[:200]}") from exc
