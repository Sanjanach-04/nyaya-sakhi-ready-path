create extension if not exists vector;

create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_language text not null default 'en' check (preferred_language in ('en','hi','kn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users can view own roles"
  on public.user_roles
  for select
  to authenticated
  using (auth.uid() = user_id);

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default 'New conversation',
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.chat_sessions to authenticated;
grant all on public.chat_sessions to service_role;
alter table public.chat_sessions enable row level security;
create policy "Users can view own chat sessions"
  on public.chat_sessions for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert own chat sessions"
  on public.chat_sessions for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update own chat sessions"
  on public.chat_sessions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Users can delete own chat sessions"
  on public.chat_sessions for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;
create policy "Users can view own chat messages"
  on public.chat_messages for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert own chat messages"
  on public.chat_messages for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can delete own chat messages"
  on public.chat_messages for delete to authenticated
  using (auth.uid() = user_id);

create table public.legal_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  document_type text not null default 'act',
  source_url text,
  version text not null default 'v1',
  is_demo boolean not null default false,
  verified boolean not null default false,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  act_name text not null,
  category text not null default 'general',
  description text,
  summary text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  version text not null default 'v1',
  language text not null default 'en',
  file_path text,
  source_id uuid references public.legal_sources(id) on delete set null,
  uploaded_by uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  act_name text not null,
  section_number text,
  section_title text,
  content text not null,
  language text not null default 'en',
  chunk_index int not null default 0,
  embedding vector(3072),
  embedding_model text,
  created_at timestamptz not null default now()
);

create index if not exists legal_document_chunks_embedding_idx
  on public.legal_document_chunks using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

create or replace function public.match_legal_chunks(
  query_embedding vector(3072),
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
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity
  from public.legal_document_chunks c
  join public.legal_documents d on d.id = c.document_id
  left join public.legal_sources s on s.id = d.source_id
  where d.status = 'approved'
    and c.embedding is not null
    and 1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) >= similarity_threshold
  order by c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;

grant execute on function public.match_legal_chunks(vector(3072), int, float) to authenticated;

create table public.government_schemes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  department text not null,
  level text not null default 'central' check (level in ('central','state')),
  state_name text,
  category text not null default 'general',
  beneficiaries text,
  eligibility jsonb not null default '[]'::jsonb,
  benefits text,
  required_documents text,
  application_process text,
  official_url text,
  source_reference text not null default 'myScheme.gov.in',
  last_verified_date date,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.complaint_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  document_type text not null,
  title text not null,
  form_data jsonb not null default '{}'::jsonb,
  draft_content text not null,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  purpose text not null,
  phone_number text not null,
  availability text,
  category text not null default 'national',
  source_reference text not null default 'Official government listing',
  is_demo boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_type text not null check (item_type in ('act','scheme','chat_message')),
  ref_id uuid,
  title text not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.scheme_eligibility_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  responses jsonb not null default '{}'::jsonb,
  recommended_scheme_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.complaint_drafts to authenticated;
grant all on public.complaint_drafts to service_role;
alter table public.complaint_drafts enable row level security;
create policy "Users can view own complaint drafts"
  on public.complaint_drafts for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert own complaint drafts"
  on public.complaint_drafts for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update own complaint drafts"
  on public.complaint_drafts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Users can delete own complaint drafts"
  on public.complaint_drafts for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.saved_items to authenticated;
grant all on public.saved_items to service_role;
alter table public.saved_items enable row level security;
create policy "Users can view own saved items"
  on public.saved_items for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert own saved items"
  on public.saved_items for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can delete own saved items"
  on public.saved_items for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert on public.scheme_eligibility_responses to authenticated;
grant all on public.scheme_eligibility_responses to service_role;
alter table public.scheme_eligibility_responses enable row level security;
create policy "Users can view own eligibility responses"
  on public.scheme_eligibility_responses for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert own eligibility responses"
  on public.scheme_eligibility_responses for insert to authenticated
  with check (auth.uid() = user_id);

grant select on public.legal_sources to anon, authenticated;
grant all on public.legal_sources to service_role;
alter table public.legal_sources enable row level security;
create policy "Public can view legal sources"
  on public.legal_sources for select to anon, authenticated
  using (true);
create policy "Admins can insert legal sources"
  on public.legal_sources for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update legal sources"
  on public.legal_sources for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select on public.legal_documents to anon, authenticated;
grant all on public.legal_documents to service_role;
alter table public.legal_documents enable row level security;
create policy "Public can view approved legal documents"
  on public.legal_documents for select to anon, authenticated
  using (status = 'approved' or public.has_role(auth.uid(), 'admin'));
create policy "Admins can insert legal documents"
  on public.legal_documents for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update legal documents"
  on public.legal_documents for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete legal documents"
  on public.legal_documents for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

grant select on public.legal_document_chunks to anon, authenticated;
grant all on public.legal_document_chunks to service_role;
alter table public.legal_document_chunks enable row level security;
create policy "Public can view chunks of approved documents"
  on public.legal_document_chunks for select to anon, authenticated
  using (
    exists (
      select 1 from public.legal_documents d
      where d.id = legal_document_chunks.document_id
        and (d.status = 'approved' or public.has_role(auth.uid(), 'admin'))
    )
  );

grant select on public.government_schemes to anon, authenticated;
grant all on public.government_schemes to service_role;
alter table public.government_schemes enable row level security;
create policy "Public can view schemes"
  on public.government_schemes for select to anon, authenticated
  using (true);
create policy "Admins can insert schemes"
  on public.government_schemes for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update schemes"
  on public.government_schemes for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete schemes"
  on public.government_schemes for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

grant select on public.emergency_contacts to anon, authenticated;
grant all on public.emergency_contacts to service_role;
alter table public.emergency_contacts enable row level security;
create policy "Public can view emergency contacts"
  on public.emergency_contacts for select to anon, authenticated
  using (true);
create policy "Admins can insert emergency contacts"
  on public.emergency_contacts for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update emergency contacts"
  on public.emergency_contacts for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete emergency contacts"
  on public.emergency_contacts for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Users can view own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger touch_chat_sessions_updated_at
  before update on public.chat_sessions
  for each row execute function public.touch_updated_at();
create trigger touch_legal_sources_updated_at
  before update on public.legal_sources
  for each row execute function public.touch_updated_at();
create trigger touch_legal_documents_updated_at
  before update on public.legal_documents
  for each row execute function public.touch_updated_at();
create trigger touch_schemes_updated_at
  before update on public.government_schemes
  for each row execute function public.touch_updated_at();
create trigger touch_complaint_drafts_updated_at
  before update on public.complaint_drafts
  for each row execute function public.touch_updated_at();
create trigger touch_emergency_contacts_updated_at
  before update on public.emergency_contacts
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();