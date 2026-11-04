# Nyaya Sakhi — Rights Companion

**Bridging the gap between women and reliable legal information through accessible, evidence-based AI assistance.**

Nyaya Sakhi helps women in India understand their legal rights in plain language, discover
government schemes they may qualify for, draft complaints and applications, and reach free
legal aid and emergency support — in English, Hindi and Kannada.

Every legal answer is built only from **admin-approved documents**. If the knowledge base
doesn't contain verified information on a question, the assistant refuses and points to
NALSA, the State Legal Services Authority or a qualified lawyer — it never improvises law.

```
┌──────────────────────────────────────────────────────────────────┐
│  Frontend — TanStack Start (React 19, TS, Tailwind v4, shadcn)   │
│  landing / auth / dashboard / chat / rights / schemes / drafter  │
│  legal-aid / emergency / history / profile / admin               │
└───────────────┬───────────────────────────┬──────────────────────┘
                │ Supabase auth             │ REST (typed client)
                ▼ (JWT)                     ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│  Lovable Cloud (Supabase)│   │  FastAPI backend (/backend)      │
│  · authentication        │   │  · RAG chat (approved docs only) │
│  · Postgres + pgvector   │◄──┤  · schemes & eligibility rules   │
│  · Row Level Security    │   │  · drafter, directories, speech  │
│    enforced per request  │   │  · admin ingestion & moderation  │
└──────────────────────────┘   └──────────────────────────────────┘
```

**The separation is deliberate:** Supabase does authentication and data
storage only. Every piece of app logic — RAG, eligibility, drafting,
directories, speech — lives in the Python backend so it can be audited,
tested and run anywhere.

## Repository layout

```
src/                    Frontend (TanStack Start; routes under src/routes/)
backend/                FastAPI backend (app/, scripts/, tests/, alembic/)
drizzle/migrations/     Database migrations 0000–0003 (applied to the cloud DB)
public/fonts/           Noto Sans Devanagari + Kannada (PDF export)
```

## Frontend setup

```bash
bun install
cp .env.example .env    # fill in VITE_* values (never commit .env)
bun run dev             # http://localhost:8080
bun run test            # vitest
```

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID` | Lovable Cloud auth + direct profile/role reads |
| `VITE_API_BASE_URL` | FastAPI backend base URL, e.g. `http://localhost:8000` |

When `VITE_API_BASE_URL` is missing or the backend is down, every data page
shows a clear "Backend not configured or unreachable" state — there are no
mock responses anywhere.

## Backend setup

See **backend/README.md** (environment tables, admin bootstrap, ingestion
workflow, provider configuration). Quick start:

```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # DATABASE_URL, SUPABASE_URL, LLM_* ...
uvicorn app.main:app --reload --port 8000    # Swagger at /docs
pytest tests -q
```

## Database setup & migrations

The migrations in `drizzle/migrations/` have been applied to the project's
cloud database:

- `0000` core schema (profiles, roles, chat, legal documents/chunks, schemes,
  drafts, emergency contacts, saved items) with RLS + grants
- `0001` embedding dimension 3072 → **768**, new tables
  (legal_document_versions, ingestion_jobs, usage_events,
  legal_aid_authorities), indexes, RLS
- `0002` chat message flags (`refused`, `is_demo`, `language`)
- `0003` `match_legal_chunks` returns document title + version

### Make the first admin

```sql
insert into public.user_roles (user_id, role)
values ('<auth-user-uuid>', 'admin')
on conflict (user_id, role) do nothing;
```

(Run in the SQL editor after the person has signed up once. The Admin card
and `/admin` appear only for users with this role, and every admin endpoint
re-checks the role server-side.)

### Demo data

`backend/scripts/seed_demo.py` (or the applied seed) inserts **clearly
labelled** demo content: two demo legal extracts, three demo schemes, the
official national helpline numbers (112/181/100/108/1098) and NALSA. Every
demo row carries `is_demo=true` and "DEMO – NOT OFFICIAL" labels in its text.
Demo legal chunks have no embeddings, so the chatbot correctly refuses until
real documents are ingested.

## How the chatbot stays honest (RAG rules)

1. The question is embedded and searched against **only approved** chunks
   (`match_legal_chunks`), with a similarity threshold.
2. No hit above threshold ⇒ exact refusal: *"I couldn't find sufficient
   verified information in my legal knowledge base to answer this question
   reliably. Please consult NALSA, your State Legal Services Authority or a
   qualified lawyer."*
3. The LLM prompt contains only the retrieved chunks and must answer from
   them, returning JSON with citations.
4. **Citation validation:** every cited chunk must be in the retrieved set,
   Act/section must match that chunk's metadata, and the explanation may not
   name any Act or section absent from the chunks. Any failure ⇒ the same
   refusal, logged.
5. Every answer shows: explanation, Act, Section, source document + version,
   a "for legal literacy, not professional legal advice" disclaimer, demo
   badges when applicable, and next-step cards (legal aid / emergency /
   drafter).

## End-to-end demo journey

1. A woman opens the app and signs in (email, Google or Lovable).
2. On **Dashboard** she picks "Ask a legal question" and types or speaks her
   concern in English, Hindi or Kannada.
3. The backend retrieves verified text from approved documents and answers
   with a plain-language explanation, the Act and Section, the source
   document and version, and a disclaimer.
4. The answer card offers next steps: free legal aid contacts, the emergency
   page (when the question suggests danger), or the complaint drafter.
5. She can save provisions, check scheme eligibility (three honest buckets —
   potentially eligible / needs verification / not matching — never a
   guarantee), draft a complaint as a PDF she reviews and submits herself,
   and find NALSA/State/District authorities.
6. Admins upload → process → verify against official text → approve legal
   documents; only approved documents ever reach the chatbot.

## Commands

| Task | Command |
| --- | --- |
| Frontend dev | `bun run dev` |
| Frontend tests | `bun run test` |
| Frontend typecheck | `bunx tsgo --noEmit` |
| Backend dev | `uvicorn app.main:app --reload --port 8000` (in `backend/`) |
| Backend tests | `pytest tests -q` (in `backend/`) |
| Seed demo data | `python -m scripts.seed_demo` (in `backend/`) |
| Ingest a document | `python -m scripts.ingest --title ... --act-name ... --file ...` |

## Known limitations

- The chatbot needs `LLM_*` configuration and at least one **approved,
  embedded** document before it can answer; until then it refuses safely.
- Speech endpoints return 501 with setup instructions until `STT_*`/`TTS_*`
  providers are configured; the browser's Web Speech API is used when
  available for microphone input and read-aloud.
- Translation is off until `TRANSLATION_PROVIDER` is configured; answers stay
  in English with a note.
- All scheme/legal-aid/emergency data beyond the seeded official helplines
  must be entered by admins after verification — nothing is scraped.
- Demo data is labelled everywhere and is not a substitute for official text.
