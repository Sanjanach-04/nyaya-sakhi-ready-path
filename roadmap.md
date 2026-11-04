# Roadmap — NYAYA SAKHI

Decisions (confirmed by user):
- Backend: Lovable Cloud (auth + Postgres/pgvector) for the running app + a separate FastAPI backend in `/backend` that owns ALL app logic via REST.
- Chat: multiple saved threads per user (thread list + dedicated thread routes), DB persistence.
- Starter data: clearly-labelled demo starter dataset, admin-expandable.

## Phase 1 — Foundation
- [x] Lovable Cloud enabled (email auth + Google & Lovable sign-in configured)
- [x] DB migrations 0000–0003: core schema, vector(768) + match_legal_chunks, new tables, indexes, RLS/GRANTS, chat flags
- [x] Seed labelled starter data (demo legal extracts, 3 demo schemes, official national helplines, NALSA) — applied to the cloud DB and `backend/scripts/seed_demo.py`
- [x] Design tokens in src/styles.css
- [x] Landing page (/) with separate Login/Register, honest wording; /auth, /reset-password, /dashboard

## Phase 2 — RAG chatbot (backend-owned)
- [x] FastAPI RAG pipeline: embed → approved-only vector search → threshold refusal → context-only LLM → citation validation → safe refusal
- [x] Chat UI: thread list, thread pages (/chat, /chat/$threadId), suggested questions, copy, typing state, delete thread/all
- [x] Answer cards: explanation, Act, Section, source + version, disclaimer, demo badge, refusal styling, next-step cards

## Phase 3 — Content modules (all real pages, placeholders removed)
- [x] Know Your Rights (/rights, /rights/$actId) with glossary tooltips, save button
- [x] Government Schemes (/schemes, /schemes/$id) with eligibility questionnaire → 3 honest buckets + disclaimer
- [x] Complaint drafter (/drafter) with templates, stepper, editable draft, PDF export (embedded Devanagari/Kannada fonts), review banner
- [x] Legal Aid directory (/legal-aid) with state selector + official links
- [x] Emergency page (/emergency) with AppShell + admin-managed contacts

## Phase 4 — Multilingual & voice
- [x] EN/HI/KN i18n (one dictionary per language), persisted in profile via backend
- [x] Voice input (Web Speech API) + read-aloud with clear setup-missing fallbacks

## Phase 5 — Admin + profile + history
- [x] Admin panel (/admin, role-gated): documents upload/process/approve/reject/replace-version, schemes CRUD + verify, emergency CRUD, legal-aid CRUD, usage stats, ingestion jobs
- [x] Profile (/profile): name, language, password change, delete-my-data
- [x] History (/history): conversations, saved items, drafts with delete one/all

## Phase 6 — FastAPI backend
- [x] Full backend source in /backend (routes, services, schemas, models, Alembic, Dockerfile, docker-compose, requirements.txt, README, scripts, demo data)
- [x] Backend tests: 28 passing (chunking, refusal threshold, fabricated-citation rejection, ownership, admin gating, eligibility buckets)
- [x] Frontend tests: 17 passing (routing/auth guards, API client errors, eligibility contract, draft-to-PDF)

## Phase 7 — Verification
- [x] Typecheck green (tsgo) and vitest suite green
- [x] Head metadata on routes
- [ ] Live end-to-end run with the backend started locally (needs user's `backend/.env` with DATABASE_URL + LLM keys; preview shows the designed "backend not configured" states until then)

## Phase 7 — Connection diagnostics & header
- [x] Public `GET /api/health` (db, embedding_model, llm_configured) + backend test
- [x] Frontend health check, three diagnostic states, Try again, connection dot, admin/dev-only Backend connection dialog
- [x] Header: one-line logo, xl-only tagline, short nav labels, hamburger below lg (checked at 360/768/1024/1440)
- [x] README "Troubleshooting: backend not configured"
