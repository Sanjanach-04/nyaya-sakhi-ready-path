"""Chunking: split legal text on Act/Section headings, preserving metadata."""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.config import settings

MAX_CHARS = 1800
OVERLAP_PARAGRAPHS = 1

# Patterns for headings in Indian statutes and consolidated extracts.
SECTION_RE = re.compile(
    r"^\s*(?:Section\s+)?(\d{1,3}[A-Z]?(\.\d+)?)\s*[\.\u2013\u2014\-\u2015:\uff0e]\s+(.+)$",
)
SECTION_PREFIX_RE = re.compile(
    r"^\s*Section\s+(\d{1,3}[A-Z]?(\.\d+)?)\s*[\.\u2013\u2014\-\u2015:\uff0e]?\s*(.*)$",
)
TITLE_LINE_RE = re.compile(r"^\s*(?:[^.\n]{3,})$", re.MULTILINE)


@dataclass
class Chunk:
    chunk_index: int
    section_number: str | None
    section_title: str | None
    content: str


def _blank(line: str) -> bool:
    return not line.strip()


def split_on_sections(text: str) -> list[tuple[str | None, str | None, str]]:
    """Return list of (section_number, section_title, body) blocks."""
    lines = text.splitlines()
    blocks: list[tuple[str | None, str | None, list[str]]] = []
    current_num: str | None = None
    current_title: str | None = None
    current_lines: list[str] = []

    def flush() -> None:
        nonlocal current_lines
        body = "\n".join(current_lines).strip()
        if body:
            blocks.append((current_num, current_title, body))
        current_lines = []

    i = 0
    while i < len(lines):
        line = lines[i]
        if _blank(line):
            current_lines.append(line)
            i += 1
            continue

        m = SECTION_PREFIX_RE.match(line)
        if not m:
            m = SECTION_RE.match(line)
        if m and (m.group(1) and len(m.group(1)) <= 5):
            flush()
            num = m.group(1)
            title = (m.group(3) or "").strip() or None
            # If the title lives on the following non-blank line, take it.
            if not title:
                j = i + 1
                while j < len(lines) and _blank(lines[j]):
                    j += 1
                if j < len(lines) and not SECTION_RE.match(lines[j]) and not SECTION_PREFIX_RE.match(lines[j]):
                    title = lines[j].strip()
                    i = j
            current_num, current_title = num, title
            current_lines.append(line)
            i += 1
            continue

        current_lines.append(line)
        i += 1

    flush()
    return [(num, title, body) for num, title, body in blocks]


def _split_long_body(body: str) -> list[str]:
    """Split an oversized block into paragraph-based pieces under MAX_CHARS."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    pieces: list[str] = []
    buffer: list[str] = []
    size = 0

    def flush_buffer() -> None:
        nonlocal buffer, size
        if buffer:
            pieces.append("\n\n".join(buffer))
            buffer = []
            size = 0

    for para in paragraphs:
        if len(para) > MAX_CHARS:
            flush_buffer()
            # hard-split by sentence
            for k in range(0, len(para), MAX_CHARS):
                pieces.append(para[k : k + MAX_CHARS])
            continue
        if size + len(para) > MAX_CHARS and buffer:
            flush_buffer()
        buffer.append(para)
        size += len(para)
    flush_buffer()
    return pieces


def chunk_text(text: str) -> list[Chunk]:
    """Split on section headings; keep section_number/title; cap chunk size."""
    if not text.strip():
        return []
    chunks: list[Chunk] = []
    blocks = split_on_sections(text)
    if not blocks:
        blocks = [(None, None, text.strip())]

    for num, title, body in blocks:
        for piece in _split_long_body(body):
            chunks.append(
                Chunk(
                    chunk_index=len(chunks),
                    section_number=num,
                    section_title=title,
                    content=piece,
                )
            )
    for idx, chunk in enumerate(chunks):
        chunk.chunk_index = idx
    return chunks
