-- Migration 0002 — chat message flags for refusal handling and demo labelling.
-- Columns are additive and safe: defaults keep every existing row valid.

alter table public.chat_messages add column if not exists refused boolean not null default false;
alter table public.chat_messages add column if not exists is_demo boolean not null default false;
alter table public.chat_messages add column if not exists language text;

-- Table-level grants already cover the new columns; re-assert to be safe.
grant select, insert, update, delete on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
