-- Guest (signed-out) access to PUBLIC legal knowledge only.
--
-- The FastAPI backend serves guests by running their queries as the Postgres
-- `anon` role, so only the existing public-read RLS policies apply:
--   legal_documents (status = 'approved'), legal_document_chunks (of approved
--   documents), government_schemes, emergency_contacts, legal_sources,
--   legal_aid_authorities.
-- Private tables (chat_sessions, chat_messages, complaint_drafts, saved_items,
-- scheme_eligibility_responses, profiles, user_roles, usage_events) have NO
-- anon grants and stay owner-only for `authenticated`.
--
-- What was missing: guest chat calls match_legal_chunks, which was only
-- executable by authenticated/service_role. The function is SECURITY INVOKER,
-- so anon still only sees chunks of approved documents.
-- Idempotent: safe to run more than once.

grant execute on function public.match_legal_chunks(vector(768), int, float) to anon;
-- Used inside the public-read policies; returns false for anon (auth.uid() is null).
grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;
