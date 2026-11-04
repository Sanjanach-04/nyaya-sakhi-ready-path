"""Citation validation: reject fabricated citations and hallucinated law.

Every failure raises CitationValidationError, which the chat route converts
into the safe refusal.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.vector_search import RetrievedChunk


class CitationValidationError(Exception):
    """Raised when the generated answer cites content outside the retrieved set."""


@dataclass
class ValidatedCitation:
    chunk_id: str
    act: str
    section: str | None


def _normalise(value: str | None) -> str:
    return (value or "").strip().rstrip(".").lower()


ACT_NUMBER_RE = re.compile(r"\b(?:act|section|sec\.?|u/s)\b", re.IGNORECASE)


def _normalise_act(value: str) -> str:
    v = value.strip().lower()
    v = re.sub(r",?\s*\d{4}\s*$", "", v)  # drop trailing year
    v = re.sub(r"\s+", " ", v)
    return v.strip(" .,")


def _section_conflicts(chunk: RetrievedChunk, claimed: str | None) -> bool:
    """True when the claimed section could NOT come from this chunk."""
    if not claimed:
        return False
    claimed_n = _normalise(claimed).removeprefix("section ").strip()
    candidates = [
        _normalise(chunk.section_number).removeprefix("section ").strip(),
        _normalise(chunk.section_title).removeprefix("section ").strip(),
        _normalise(chunk.content[:120]).removeprefix("section ").strip(),
    ]
    for cand in candidates:
        if not cand:
            continue
        if claimed_n == cand:
            return False
        # "5" claimed and chunk says "5. Protection of ..." (title starts with num)
        if re.match(rf"^{re.escape(claimed_n)}\b", cand):
            return False
        # claimed "5a" vs chunk title "5A -dowry" etc.
        if re.match(rf"^{re.escape(claimed_n)}\s*[-–:.]", cand):
            return False
    return True


def validate_citations(
    generated: dict, chunks: list[RetrievedChunk]
) -> list[ValidatedCitation]:
    """Validate every cited chunk_id, act and section against the retrieved set.

    Also rejects explanations that mention Acts/sections absent from the
    retrieved chunks (the common hallucination pattern). A similarity score is
    never treated as proof of correctness — only structural checks here.
    """
    by_id = {c.chunk_id: c for c in chunks}
    allowed_act_names = {_normalise_act(c.act_name) for c in chunks}
    allowed_sections: set[str] = set()
    for c in chunks:
        for value in (c.section_number, c.section_title):
            if value:
                allowed_sections.add(_normalise(value).removeprefix("section ").strip())

    cited: list[ValidatedCitation] = []
    for raw in generated.get("citations", []) or []:
        chunk_id = str(raw.get("chunk_id", ""))
        if chunk_id not in by_id:
            raise CitationValidationError(f"Cited chunk_id {chunk_id!r} is not in the retrieved set")
        chunk = by_id[chunk_id]
        act = str(raw.get("act", "") or chunk.act_name)
        if _normalise_act(act) not in allowed_act_names:
            raise CitationValidationError(
                f"Cited act {act!r} does not match any retrieved chunk"
            )
        section = raw.get("section")
        if section and _section_conflicts(chunk, str(section)):
            raise CitationValidationError(
                f"Cited section {section!r} does not match the cited chunk"
            )
        if section:
            cited.append(ValidatedCitation(chunk_id, chunk.act_name, str(section)))
        else:
            cited.append(ValidatedCitation(chunk_id, chunk.act_name, None))

    if not cited:
        raise CitationValidationError("Answer contains no citations to retrieved chunks")

    # The explanation must not name any Act not present in the chunks.
    # Match title-cased Act/Code names — lowercase prose like "under this act"
    # is not a fabrication signal.
    explanation = str(generated.get("explanation", "") or "")
    for match in re.finditer(
        r"\b((?:[A-Z][A-Za-z]+(?:\s+(?:of|and|&|from|the|for|to|Against|Protection|Benefit|Relief|Act|Code|Rules|Amendment)?)?\s*)+(?:Act|Code|Rules|Amendment|Ordinance))\b",
        explanation,
    ):
        if _normalise_act(match.group(1)) not in allowed_act_names:
            raise CitationValidationError(
                f"Explanation references an Act not present in retrieved chunks: {match.group(1)!r}"
            )
    for m in re.finditer(r"\b[Ss]ection\s+(\d{1,3}[A-Z]?(?:\.\d+)?)\b", explanation):
        claimed = _normalise(m.group(1))
        if claimed and claimed not in allowed_sections:
            raise CitationValidationError(
                f"Explanation references a section not present in retrieved chunks: {m.group(0)!r}"
            )
    return cited
