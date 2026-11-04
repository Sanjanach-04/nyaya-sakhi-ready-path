-- Migration 0001 — expand core schema (Nyaya Sakhi)
-- 1. Embeddings move from vector(3072) to vector(768) for the
--    sentence-transformers multilingual model
--    "paraphrase-multilingual-mpnet-base-v2". The dimension is configurable:
--    see backend/app/core/config.py (EMBEDDING_MODEL / EMBEDDING_DIM) and
--    README.md ("Changing the embedding model"). Changing it requires
--    re-embedding every stored chunk.
-- 2. New tables: legal_document_versions, ingestion_jobs, usage_events,
--    legal_aid_authorities.
-- 3. Foreign-key and (user_id, created_at) indexes.
-- 4. RLS + GRANTs for the new tables (users see only their own rows;
--    admin-only writes via public.has_role).
--
-- NOTE: run only when legal_document_chunks is empty, or re-embed all chunks
-- afterwards (old 3072-dim vectors cannot be converted).

-- ============ 1. Embedding dimension 3072 -> 768 ============
drop index if exists public.legal_document_chunks_embedding_idx;
drop function if exists public.match_legal_chunks(vector(3072), int, float);

alter table public.legal_document_chunks
  alter column embedding type vector(768);

create index if not exists legal_document_chunks_embedding_idx
  on public.legal_document_chunks using hnsw ((embedding::halfvec(768)) halfvec_cosine_ops);

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

-- ============ 2. New tables ============
create table public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  version text not null,
  replaced_by uuid,
  source_title text,
  source_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.legal_documents(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  error text,
  chunks_created int not null default 0,
  embeddings_created int not null default 0,
  pages_processed int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.legal_aid_authorities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text not null check (level in ('national','state','district')),
  state text,
  district text,
  address text,
  phone text,
  website text,
  source_reference text not null,
  last_verified_date date,
  is_demo boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ 3. Indexes ============
create index if not exists chat_sessions_user_id_idx on public.chat_sessions (user_id);
create index if not exists chat_messages_user_created_idx on public.chat_messages (user_id, created_at);
create index if not exists chat_messages_session_id_idx on public.chat_messages (session_id);
create index if not exists complaint_drafts_user_id_idx on public.complaint_drafts (user_id);
create index if not exists saved_items_user_id_idx on public.saved_items (user_id);
create index if not exists scheme_eligibility_responses_user_id_idx on public.scheme_eligibility_responses (user_id);
create index if not exists usage_events_user_created_idx on public.usage_events (user_id, created_at);
create index if not exists legal_documents_source_id_idx on public.legal_documents (source_id);
create index if not exists legal_document_chunks_document_id_idx on public.legal_document_chunks (document_id);
create index if not exists legal_document_versions_document_id_idx on public.legal_document_versions (document_id);
create index if not exists ingestion_jobs_document_id_idx on public.ingestion_jobs (document_id);

-- ============ 4. GRANTs + RLS ============
-- legal_document_versions: history of document versions.
grant select on public.legal_document_versions to authenticated;
grant all on public.legal_document_versions to service_role;
alter table public.legal_document_versions enable row level security;
create policy "Users can view versions of visible documents"
  on public.legal_document_versions for select to authenticated
  using (
    exists (
      select 1 from public.legal_documents d
      where d.id = legal_document_versions.document_id
        and (d.status = 'approved' or public.has_role(auth.uid(), 'admin'))
    )
  );
create policy "Admins can insert document versions"
  on public.legal_document_versions for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update document versions"
  on public.legal_document_versions for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete document versions"
  on public.legal_document_versions for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ingestion_jobs: admin-only.
grant select, insert, update on public.ingestion_jobs to authenticated;
grant all on public.ingestion_jobs to service_role;
alter table public.ingestion_jobs enable row level security;
create policy "Admins can manage ingestion jobs"
  on public.ingestion_jobs for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- usage_events: users write their own, read their own; admins read all.
grant select, insert on public.usage_events to authenticated;
grant all on public.usage_events to service_role;
alter table public.usage_events enable row level security;
create policy "Users can insert own usage events"
  on public.usage_events for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can view own usage events"
  on public.usage_events for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- legal_aid_authorities: public read (official directory), admin writes.
grant select on public.legal_aid_authorities to anon, authenticated;
grant all on public.legal_aid_authorities to service_role;
alter table public.legal_aid_authorities enable row level security;
create policy "Public can view legal aid authorities"
  on public.legal_aid_authorities for select to anon, authenticated
  using (true);
create policy "Admins can insert legal aid authorities"
  on public.legal_aid_authorities for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update legal aid authorities"
  on public.legal_aid_authorities for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete legal aid authorities"
  on public.legal_aid_authorities for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger for the new timestamped table.
create trigger touch_legal_aid_authorities_updated_at
  before update on public.legal_aid_authorities
  for each row execute function public.touch_updated_at();
