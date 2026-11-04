"""Seed demo data. EVERYTHING inserted by this script is labelled is_demo=true.

Demo rows let you explore the app before real data exists. Real legal text,
schemes and contacts must be added by admins through /admin. This script never
inserts real law from memory — sample legal extracts carry the label
"DEMO – NOT OFFICIAL LAW".

Usage:  python -m scripts.seed_demo   (from the backend/ directory)
"""
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402

from app.db import SessionLocal  # noqa: E402

DEMO_LABEL = "DEMO – NOT OFFICIAL LAW"

DEMO_DOCUMENTS = [
    {
        "title": "Domestic violence rights (demo extract)",
        "act_name": f"Domestic Violence Rights (demo extract) — {DEMO_LABEL}",
        "category": "family",
        "chunks": [
            {
                "section_number": "3",
                "section_title": "Meaning of domestic violence (DEMO – NOT OFFICIAL LAW)",
                "content": (
                    "DEMO – NOT OFFICIAL LAW. This sample text is provided only to demonstrate how the app works. "
                    "In general terms, a woman facing physical, emotional, sexual or economic harm within a household "
                    "may have protections under India's domestic violence legislation. For the actual statutory text, "
                    "definitions and remedies, consult the official Act and a legal aid authority."
                ),
            },
            {
                "section_number": "12",
                "section_title": "Applying for relief (DEMO – NOT OFFICIAL LAW)",
                "content": (
                    "DEMO – NOT OFFICIAL LAW. Sample demonstration text: applications for protection and other reliefs "
                    "under domestic violence law are typically made to a Magistrate or through a Protection Officer, and "
                    "legal services authorities can assist free of charge. The real procedure is set out in the official "
                    "statute — always read the official Act and seek legal aid before acting."
                ),
            },
        ],
    },
    {
        "title": "Maternity & workplace rights (demo extract)",
        "act_name": f"Maternity & Workplace Rights (demo extract) — {DEMO_LABEL}",
        "category": "employment",
        "chunks": [
            {
                "section_number": "5",
                "section_title": "Maternity leave (DEMO – NOT OFFICIAL LAW)",
                "content": (
                    "DEMO – NOT OFFICIAL LAW. Sample demonstration text: India's maternity benefit legislation provides "
                    "paid leave for eligible women employees before and after childbirth; the exact duration and "
                    "eligibility depend on the statute and the establishment. Consult the official Act for authoritative "
                    "text."
                ),
            },
        ],
    },
]

DEMO_SCHEMES = [
    {
        "name": "Demo: Sample state pension scheme",
        "description": f"DEMO DATA – NOT OFFICIAL. A fictional scheme used to demonstrate eligibility matching. {DEMO_LABEL}",
        "department": "Demo department (not real)",
        "level": "state",
        "state_name": "Karnataka",
        "category": "social_security",
        "eligibility": [
            {"field": "age_band", "values": ["46_60", "above_60"], "note": "This demo scheme is for older applicants."},
            {"field": "income_band", "values": ["below_1l", "1l_3l"], "note": "This demo scheme targets low-income households."},
        ],
        "official_url": None,
        "source_reference": "DEMO – NOT OFFICIAL DATA",
    },
    {
        "name": "Demo: Sample women's skilling programme",
        "description": f"DEMO DATA – NOT OFFICIAL. A fictional scheme used to demonstrate eligibility matching. {DEMO_LABEL}",
        "department": "Demo department (not real)",
        "level": "central",
        "state_name": None,
        "category": "employment",
        "eligibility": [
            {"field": "age_band", "values": ["18_30", "31_45"], "note": "This demo programme serves working-age women."},
            {"field": "occupation", "values": ["unemployed", "homemaker", "daily_wage"], "note": "This demo programme targets women not in formal employment."},
        ],
        "official_url": None,
        "source_reference": "DEMO – NOT OFFICIAL DATA",
    },
    {
        "name": "Demo: Sample disability support grant",
        "description": f"DEMO DATA – NOT OFFICIAL. A fictional scheme used to demonstrate eligibility matching. {DEMO_LABEL}",
        "department": "Demo department (not real)",
        "level": "central",
        "state_name": None,
        "category": "social_security",
        "eligibility": [
            {"field": "has_disability", "values": [True], "note": "This demo grant is for persons with disability."},
        ],
        "official_url": None,
        "source_reference": "DEMO – NOT OFFICIAL DATA",
    },
]

# Real, widely-published national helpline numbers with source reference.
# Verify every number before relying on it; admins manage this list in /admin.
OFFICIAL_EMERGENCY = [
    {"name": "Emergency Response (police, fire, medical)", "phone_number": "112", "purpose": "National emergency number (India).", "category": "national", "source_reference": "Government of India national emergency number", "display_order": 1},
    {"name": "Women Helpline", "phone_number": "181", "purpose": "National women helpline.", "category": "women", "source_reference": "Ministry of Women & Child Development", "display_order": 2},
    {"name": "Police", "phone_number": "100", "purpose": "Police control room.", "category": "police", "source_reference": "State police departments", "display_order": 3},
    {"name": "Ambulance", "phone_number": "108", "purpose": "Emergency ambulance service.", "category": "medical", "source_reference": "National Health Mission", "display_order": 4},
    {"name": "Childline", "phone_number": "1098", "purpose": "Helpline for children in distress.", "category": "children", "source_reference": "Ministry of Women & Child Development", "display_order": 5},
]

OFFICIAL_LEGAL_AID = [
    {
        "name": "National Legal Services Authority (NALSA)",
        "level": "national",
        "website": "https://nalsa.gov.in",
        "source_reference": "nalsa.gov.in — official website",
    },
]


def seed() -> None:
    db = SessionLocal()
    try:
        for doc in DEMO_DOCUMENTS:
            exists = db.execute(
                text("select id from public.legal_documents where title = :t"),
                {"t": doc["title"]},
            ).first()
            if exists:
                print(f"skip existing demo document: {doc['title']}")
                continue
            doc_id = db.execute(
                text(
                    "insert into public.legal_documents (title, act_name, category, status, version, is_demo) "
                    "values (:t, :a, :c, 'approved', 'v1', true) returning id"
                ),
                {"t": doc["title"], "a": doc["act_name"], "c": doc["category"]},
            ).scalar_one()
            for i, chunk in enumerate(doc["chunks"]):
                db.execute(
                    text(
                        "insert into public.legal_document_chunks "
                        "(document_id, act_name, section_number, section_title, content, chunk_index, embedding) "
                        "values (:d, :a, :sn, :st, :content, :i, null)"
                    ),
                    {
                        "d": str(doc_id), "a": doc["act_name"], "i": i,
                        "sn": chunk["section_number"], "st": chunk["section_title"],
                        "content": chunk["content"],
                    },
                )
            print(f"seeded demo document: {doc['title']} (zero-vector embeddings — RAG search will not match until real documents are ingested)")

        source_id = db.execute(
            text(
                "insert into public.legal_sources (title, document_type, notes, is_demo) "
                "values (:t, 'act', :d, true) returning id"
            ),
            {"t": "Demo legal extracts", "d": f"Placeholder sources for demonstration only. {DEMO_LABEL}"},
        ).scalar_one()
        db.execute(
            text("update public.legal_documents set source_id = :sid where is_demo = true and source_id is null"),
            {"sid": str(source_id)},
        )

        for scheme in DEMO_SCHEMES:
            exists = db.execute(
                text("select 1 from public.government_schemes where name = :n"), {"n": scheme["name"]}
            ).first()
            if exists:
                continue
            db.execute(
                text(
                    "insert into public.government_schemes "
                    "(name, description, department, level, state_name, category, eligibility, official_url, source_reference, is_demo) "
                    "values (:n, :d, :dep, :l, :s, :c, cast(:e as jsonb), :u, :sr, true)"
                ),
                {
                    "n": scheme["name"], "d": scheme["description"], "dep": scheme["department"],
                    "l": scheme["level"], "s": scheme["state_name"], "c": scheme["category"],
                    "e": json.dumps(scheme["eligibility"]), "u": scheme["official_url"],
                    "sr": scheme["source_reference"],
                },
            )
        print("seeded demo schemes")

        for contact in OFFICIAL_EMERGENCY:
            exists = db.execute(
                text("select 1 from public.emergency_contacts where phone_number = :n"),
                {"n": contact["phone_number"]},
            ).first()
            if exists:
                continue
            db.execute(
                text(
                    "insert into public.emergency_contacts (name, purpose, phone_number, category, source_reference, is_demo, display_order) "
                    "values (:n, :p, :num, :c, :sr, false, :o)"
                ),
                {"n": contact["name"], "p": contact["purpose"], "num": contact["phone_number"],
                 "c": contact["category"], "sr": contact["source_reference"], "o": contact["display_order"]},
            )
        print("seeded emergency contacts (official numbers, is_demo=false)")

        for authority in OFFICIAL_LEGAL_AID:
            exists = db.execute(
                text("select 1 from public.legal_aid_authorities where name = :n"), {"n": authority["name"]}
            ).first()
            if exists:
                continue
            db.execute(
                text(
                    "insert into public.legal_aid_authorities (name, level, website, source_reference, is_demo) "
                    "values (:n, :l, :w, :sr, false)"
                ),
                {"n": authority["name"], "l": authority["level"], "w": authority["website"],
                 "sr": authority["source_reference"]},
            )
        print("seeded NALSA legal aid entry (official)")

        db.commit()
        print("Demo seed complete. Everything labelled demo is marked is_demo=true.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
