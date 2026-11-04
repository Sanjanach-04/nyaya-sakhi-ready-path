"""Tests for the chunking service."""
from __future__ import annotations

from app.services.chunking import chunk_text

SAMPLE = """THE PROTECTION OF WOMEN FROM DOMESTIC VIOLENCE ACT, 2005

An Act to provide for more effective protection.

Section 3. Definition of domestic violence
For the purposes of this Act, any act, omission or commission that harms or
injures or has the potential to harm will constitute domestic violence.

Section 4. Information to Protection Officer
A person who has reason to believe that an act of domestic violence has been
committed may inform the Protection Officer.
"""


def test_splits_on_section_headings():
    chunks = chunk_text(SAMPLE)
    sections = [c.section_number for c in chunks]
    assert "3" in sections
    assert "4" in sections


def test_preserves_section_titles():
    chunks = chunk_text(SAMPLE)
    titles = {c.section_number: c.section_title for c in chunks}
    assert titles["3"] and "Definition" in titles["3"]


def test_preamble_chunk_has_no_section():
    chunks = chunk_text(SAMPLE)
    first = chunks[0]
    assert first.section_number is None
    assert "An Act to provide" in first.content


def test_chunk_indexes_are_sequential():
    chunks = chunk_text(SAMPLE)
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))


def test_long_bodies_are_split():
    long_text = "Section 1. Test\n" + ("word " * 800)
    chunks = chunk_text(long_text)
    assert all(len(c.content) <= 2000 for c in chunks)
    assert len(chunks) >= 2


def test_empty_text_returns_no_chunks():
    assert chunk_text("   \n  ") == []
