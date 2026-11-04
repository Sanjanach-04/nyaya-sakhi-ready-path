# Nyaya Sakhi Backend (FastAPI)

Python 3.11 · FastAPI · Pydantic v2 · SQLAlchemy 2 + Alembic · PostgreSQL (Supabase) · pgvector

This backend owns **all app logic**: chat/RAG, legal browsing, schemes &
eligibility, complaint drafting, legal aid & emergency directories, speech and
translation. Supabase (Lovable Cloud) is used only for authentication and the
Postgres database (with Row Level Security enforced per request).

## Architecture

```
Browser (React/TanStack frontend)
        │  Authorization: Bearer <Supabase access token>
        ▼
FastAPI (/backend)  ── verify JWT (JWKS or secret)
        │                 ── RLS-scoped DB session (SET LOCAL ROLE authenticated)
        │                 ── admin routes gated by public.user_roles
        ▼
Postgres: profiles, user_roles, legal_documents/chunks (pgvector 768),
          chat_sessions/messages, government_schemes, complaint_drafts,
          emergency_contacts, legal_aid_authorities, usage_events, ...
        ▲
        └── services: ingestion → extraction → chunking → embedding (768-d)
                      → vector search (approved only) → LLM (context-only)
                      → citation validation → refusal / translation / speech
```

## Setup

```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in the values (never commit .env)
uvicorn app.main:app --reload --port 8000
# Swagger: http://localhost:8000/docs
```

Docker alternative:

```bash
docker compose up --build     # API on :8000
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string (`postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres`) |
| `SUPABASE_URL` | yes | Project URL, used for JWKS discovery |
| `SUPABASE_JWT_SECRET` | optional | Legacy HS256 verification; JWKS is used when empty |
| `SUPABASE_PUBLISHABLE_KEY` | optional | Sent with JWKS discovery requests |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | for chat answers | Any OpenAI-compatible chat-completions endpoint |
| `EMBEDDING_MODEL` | no | Default `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` |
| `EMBEDDING_DIM` | no | Default `768` (must match the DB `vector(n)` dimension) |
| `SIMILARITY_THRESHOLD` | no | Default `0.35`; chunks below this are never retrieved |
| `SCOPE_THRESHOLD` | no | Default `0.5`; best hit below this ⇒ "outside verified scope" refusal |
| `TRANSLATION_PROVIDER` | no | `none` \| `libretranslate` \| `llm` |
| `LIBRETRANSLATE_URL` | for libretranslate | LibreTranslate server URL |
| `STT_PROVIDER` / `STT_BASE_URL` / `STT_API_KEY` | for speech-to-text | e.g. a Whisper-compatible endpoint |
| `TTS_PROVIDER` / `TTS_BASE_URL` / `TTS_API_KEY` | for text-to-speech | e.g. an OpenAI-compatible `/speech` endpoint |
| `UPLOAD_DIR` | no | Where uploaded documents are stored (default `./data/uploads`) |
| `CORS_ORIGINS` | no | Comma-separated origins allowed by the browser |

### Making the first admin

Run this once in the database (SQL editor) with the new admin's auth user id:

```sql
insert into public.user_roles (user_id, role)
values ('<auth-user-uuid>', 'admin')
on conflict (user_id, role) do nothing;
```

Admin routes (`/api/admin/*`) check this table server-side via
`public.has_role`; there is no client-side admin check anywhere.

## Database migrations

The Supabase/Lovable Cloud instance holds migrations `0000`–`0003`
(`drizzle/migrations/` in the repo root). The backend also ships an Alembic
setup for local Postgres use:

```bash
alembic revision --autogenerate -m "..."
alembic upgrade head
```

Key schema points:

- `legal_document_chunks.embedding` is `vector(768)` (see migration `0001`).
  The dimension is configurable via `EMBEDDING_DIM`; **changing the model or
  dimension requires re-embedding every stored chunk.**
- `match_legal_chunks(vector, count, threshold)` searches ONLY chunks of
  documents with `status='approved'` (cosine distance, HNSW halfvec index).
- `chat_messages` carries `refused`, `is_demo`, `language` (migration `0002`).

## Adding legal documents (the safe path)

1. **Verify the source first.** Download the official text (e.g. from
   India Code) and read it yourself. Never trust an unverified file.
2. Sign in as an admin → **Admin → Documents → Upload** (title, Act name,
   category, optional description/summary, PDF or TXT). The document stays
   `pending` — uploads are **never** auto-verified.
3. **Process & embed** — extracts text, splits on Act/Section headings
   (preserving section numbers/titles), embeds with the configured model,
   stores chunks. Every run is recorded in `ingestion_jobs`.
4. **Read every chunk and compare it against the official text.** Fix
   extraction errors by uploading a corrected file; use **Replace version**
   to upload a new version (history is kept in `legal_document_versions`,
   the document returns to `pending`).
5. **Approve** only after verification. Only `approved` documents reach the
   chatbot and the legal browser. Reject keeps content out of the app.

CLI alternative (same pending-until-approved rule):

```bash
python -m scripts.ingest --title "..." --act-name "..." --file ./act.pdf
```

## Adding scheme data

- Admin → Schemes: create/update (name, department, level, state, category,
  eligibility rules, benefits, documents, process, official URL, source
  reference), then **Mark verified** once you have checked the official page.
- Eligibility rules are JSONB arrays:
  `[{"field": "age_band", "values": ["46_60"], "note": "why"}]`.
  Supported fields: `state, age_band, marital_status, social_category,
  income_band, occupation, has_disability, housing`.
- `data/schemes.sample.json` contains DEMO-labelled examples (not real data).

## Configuring LLM / speech / translation

- **LLM** — any OpenAI-compatible `/chat/completions`. The prompt contains
  ONLY retrieved approved chunks and must return JSON
  `{explanation, citations[], refused}`; output is validated (every cited
  `chunk_id` must exist in the retrieved set, Act/section must match chunk
  metadata, and the explanation may not name Acts/sections absent from the
  chunks). Any failure ⇒ the fixed safe refusal, logged in `usage_events`.
- **STT/TTS** — set the `STT_*`/`TTS_*` variables; until then
  `/api/speech/*` returns **501** with a setup message.
- **Translation** — LibreTranslate or the LLM; only the explanation is
  translated, Act/Section references stay verbatim.

## API overview (all responses use `{"detail": "..."}` on error)

| Group | Endpoints |
| --- | --- |
| Auth | `GET/PUT /api/auth/profile` |
| Chat | `POST /api/chat/ask`, `GET /api/chat/history`, `GET/DELETE /api/chat/history/{id}`, `DELETE /api/chat/history` |
| Legal | `GET /api/legal/acts`, `GET /api/legal/acts/{id}`, `GET /api/legal/search?q=` (approved only) |
| Schemes | `GET /api/schemes`, `GET /api/schemes/{id}`, `POST /api/schemes/recommend` |
| Complaints | `GET /api/complaints/templates`, `POST /api/complaints/generate`, `GET/POST /api/complaints`, `GET/PUT/DELETE /api/complaints/{id}` |
| Directory | `GET /api/emergency`, `GET /api/legal-aid`, `GET/POST /api/saved`, `DELETE /api/saved/{id}` |
| Speech | `POST /api/speech/stt`, `POST /api/speech/tts` (501 until configured) |
| Admin | `POST /api/admin/documents/upload`, `POST /api/admin/documents/{id}/process`, `POST /api/admin/documents/{id}/approve`, `POST /api/admin/documents/{id}/reject`, `POST /api/admin/documents/{id}/replace-version`, `GET /api/admin/documents`, `GET /api/admin/jobs`, `POST/PUT/DELETE /api/admin/schemes`, `POST /api/admin/schemes/{id}/verify`, `POST/PUT/DELETE /api/admin/emergency`, `POST/PUT/DELETE /api/admin/legal-aid`, `GET /api/admin/stats` |

## Tests

```bash
pytest tests -q          # 28 tests: chunking, refusals, citation
                         # validation, ownership, admin gating, eligibility
```

## Known limitations

- Demo documents have no embeddings, so the chatbot returns the safe refusal
  until a real document is ingested and approved.
- Complaint submission is intentionally absent — Nyaya Sakhi never submits
  anything; users download and submit drafts themselves.
- Demo/seed data is labelled `is_demo=true` and "DEMO – NOT OFFICIAL";
  real law, schemes, contacts and authorities must come from admins.
