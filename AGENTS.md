<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- Supabase (Lovable Cloud) is used ONLY for authentication and Postgres/pgvector storage. All app logic (chat/RAG, legal, schemes, complaints, legal aid, emergency, speech, translation, admin) lives in the FastAPI backend under `/backend` and is called via the typed client `src/lib/api.ts` with `VITE_API_BASE_URL`. Do not replace it with Supabase Edge Functions or TypeScript server functions.
- The frontend never mocks, fakes or fabricates data. If `VITE_API_BASE_URL` is unset or the backend is unreachable, pages show the dedicated backend-state component instead of data.
- The chatbot answers ONLY from admin-approved documents. Refusals use the exact fixed message in `backend/app/services/refusal_confidence.py`; citation output is validated server-side before it is shown.
- `match_legal_chunks(vector(768), int, float)` must keep filtering to `status='approved'` documents; the embedding dimension and model are configured in `backend/.env` (`EMBEDDING_DIM`/`EMBEDDING_MODEL`) and changing either requires re-embedding every stored chunk.
- Database migrations live in `drizzle/migrations/` (0000–0003 applied). Backend `models.py` column names must match those migrations exactly; schema changes need a new migration file, not model-only edits.
- Frontend Vitest tests live in `src/test/`; backend pytest tests in `backend/tests/`. Run both before claiming a fix.
- Publish builds run from the committed snapshot and never see gitignored `.env`; keep the public client values (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID) in the tracked `.env.production` (gitignore allows it) so published bundles can never ship without the cloud connection.
