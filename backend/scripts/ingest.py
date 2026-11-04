"""CLI ingestion: process a document file into the knowledge base.

Creates a pending legal_document, runs extract → chunk → embed → store.

Usage:
  python -m scripts.ingest --title "..." --act-name "..." \
      --category employment --file /path/to/file.pdf [--language en]

The document stays PENDING — an admin must approve it in /admin before the
chatbot can use it. Alternatively run scripts.seed_demo for demo content.
"""
from __future__ import annotations

import argparse
import pathlib
import sys
import uuid

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.models import LegalDocument  # noqa: E402
from app.services import ingestion  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest a legal document (stays pending until approved)")
    parser.add_argument("--title", required=True)
    parser.add_argument("--act-name", required=True)
    parser.add_argument("--category", default="general")
    parser.add_argument("--language", default="en")
    parser.add_argument("--file", required=True, help="Path to a PDF or TXT file")
    args = parser.parse_args()

    path = pathlib.Path(args.file)
    if not path.exists():
        print(f"File not found: {path}")
        sys.exit(1)

    with SessionLocal() as db:
        doc_id = uuid.uuid4()
        stored = ingestion.save_upload(path.read_bytes(), path.name, str(doc_id))
        db.execute(
            text(
                "insert into public.legal_documents "
                "(id, title, act_name, category, status, version, language, file_path) "
                "values (:id, :title, :act_name, :category, 'pending', 'v1', :language, :file_path)"
            ),
            {
                "id": str(doc_id), "title": args.title, "act_name": args.act_name,
                "category": args.category, "language": args.language, "file_path": stored,
            },
        )
        db.commit()
        document = db.execute(
            text("select * from public.legal_documents where id = :id"), {"id": str(doc_id)}
        ).mappings().one()
        job = ingestion.ingest_document(db, LegalDocument(**dict(document)))
        print(f"Stored document {doc_id} with {job.chunks_created} chunks.")
        print("Status: PENDING — approve it in the admin panel after verifying against the official text.")


if __name__ == "__main__":
    main()
