"""Embeddings as vector(768), rebuilt HNSW index, match_legal_chunks.

Matches the multilingual sentence-transformers model
(paraphrase-multilingual-mpnet-base-v2, 768 dims). Mirrors
drizzle/migrations/0001 + 0003 and is idempotent, so it is safe on a
database where those were already applied (it then only rebuilds the index
and function).

If the column currently has another dimension, existing vectors cannot be
converted: they are set to NULL and every document must be re-processed
(admin → Process, or scripts/ingest.py). Approved documents without
embeddings are simply not retrievable, so the chatbot refuses instead of
answering from stale vectors.

Revision ID: 0001_embedding_768
Revises:
Create Date: 2026-11-04
"""
from __future__ import annotations

from alembic import op

revision = "0001_embedding_768"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("create extension if not exists vector")

    # 1. Column -> vector(768) only when it is not already 768-dim.
    op.execute(
        """
        do $$
        declare current_dim int;
        begin
          select a.atttypmod into current_dim
          from pg_attribute a
          where a.attrelid = 'public.legal_document_chunks'::regclass
            and a.attname = 'embedding'
            and not a.attisdropped;

          if current_dim is distinct from 768 then
            drop index if exists public.legal_document_chunks_embedding_idx;
            execute 'drop function if exists public.match_legal_chunks(vector(' || current_dim || '), int, float)';
            update public.legal_document_chunks set embedding = null where embedding is not null;
            alter table public.legal_document_chunks
              alter column embedding type vector(768) using null;
            raise notice 'embedding column changed from % to 768 dims; re-process all documents', current_dim;
          end if;
        end $$;
        """
    )

    # 2. Rebuild the HNSW cosine index.
    op.execute("drop index if exists public.legal_document_chunks_embedding_idx")
    op.execute(
        "create index legal_document_chunks_embedding_idx on public.legal_document_chunks "
        "using hnsw ((embedding::halfvec(768)) halfvec_cosine_ops)"
    )

    # 3. Retrieval function: approved documents only, cosine similarity >= threshold.
    op.execute("drop function if exists public.match_legal_chunks(vector(768), int, float)")
    op.execute(
        """
        create or replace function public.match_legal_chunks(
          query_embedding vector(768),
          match_count int default 5,
          similarity_threshold float default 0.35
        )
        returns table (
          chunk_id uuid,
          document_id uuid,
          act_name text,
          section_number text,
          section_title text,
          content text,
          document_title text,
          document_version text,
          is_demo boolean,
          source_title text,
          source_version text,
          similarity float
        )
        language sql
        stable
        security invoker
        set search_path = public
        as $$
          select
            c.id,
            c.document_id,
            c.act_name,
            c.section_number,
            c.section_title,
            c.content,
            d.title as document_title,
            d.version as document_version,
            d.is_demo as is_demo,
            s.title as source_title,
            s.version as source_version,
            1 - (c.embedding::halfvec(768) <=> query_embedding::halfvec(768)) as similarity
          from public.legal_document_chunks c
          join public.legal_documents d on d.id = c.document_id
          left join public.legal_sources s on s.id = d.source_id
          where d.status = 'approved'
            and c.embedding is not null
            and 1 - (c.embedding::halfvec(768) <=> query_embedding::halfvec(768)) >= similarity_threshold
          order by c.embedding::halfvec(768) <=> query_embedding::halfvec(768)
          limit match_count;
        $$;
        """
    )
    op.execute(
        "grant execute on function public.match_legal_chunks(vector(768), int, float) to authenticated"
    )
    op.execute(
        "grant execute on function public.match_legal_chunks(vector(768), int, float) to service_role"
    )


def downgrade() -> None:
    # Vectors cannot be converted back to another dimension; keep the schema.
    pass
