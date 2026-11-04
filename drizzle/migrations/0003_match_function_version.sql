-- Migration 0003 — match_legal_chunks also returns the document's version
-- label (d.version), document title and is_demo flag, so answers can show
-- which version of a document the cited text came from and badge demo data.
-- Search behaviour is unchanged (approved documents only, cosine, threshold).

drop function if exists public.match_legal_chunks(vector(768), int, float);
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

grant execute on function public.match_legal_chunks(vector(768), int, float) to authenticated;
grant execute on function public.match_legal_chunks(vector(768), int, float) to service_role;
