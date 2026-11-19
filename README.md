# TensorLM

Upload any paper. Understand it deeply. AI explanations with diagrams, examples, math and citations.

```
tensorlm/
├── apps/web/                 # Next.js app: UI, API routes, queue functions (cleanup, sweepers)
├── services/worker/          # Python worker: the ingest-document queue function (Docling, OCR, figures, embeddings)
├── contracts/ingestion.json  # stage names, learner words, error copy, limits — shared by web and worker
├── supabase/migrations/      # Postgres schema, pgvector, RLS, hybrid search, stage machine, storage
├── docs/                     # specs (docs/specs/ingestion.md), backlog, progress log, reports
└── .env.example
```

## How it works

```
Browser ── pre-check (type, size, SHA-256 in a Web Worker)
   │
   ├─ POST /api/notebooks/:id/documents ─▶ Next.js: auth, ownership, quota, duplicate check, row "uploading"
   ├─ TUS resumable upload ──────────────▶ Supabase Storage  documents/<user>/<doc>/source.pdf
   └─ POST /api/documents/:id/uploaded ──▶ Next.js: object exists → "queued" → event document/uploaded
                                                                                   │
                                     Inngest ◀─────────────────────────────────────┘
                                        │  (2 runs at a time, 2 per person, 3 retries per step,
                                        │   cancelled by re-process / delete)
                                        ▼
                         Worker /api/inngest  ingest-document
                           validate → parse (Docling, OCR only for scanned pages) → figures
                           → captions (fast vision model) → index (chunks + embeddings) → finalize
                                        │  set_document_stage() / finalize_ingest()
                                        ▼
                         Postgres: documents.stage + progress ──Realtime──▶ source cards update live
                                   chunks (pages, bboxes, headings) · figures · hybrid_search()
```

The full design is in [`docs/specs/ingestion.md`](docs/specs/ingestion.md).

---

## 1. Install these on your machine

| Tool | Version | Check |
|---|---|---|
| Node.js | 22.12 or newer | `node -v` |
| Python | 3.12 | `python --version` |
| Docker Desktop | for the local Supabase stack and the worker image | `docker -v` |
| Git | any | `git --version` |

## 2. Accounts and keys

| Service | Why | Variables |
|---|---|---|
| **Supabase** | Postgres + pgvector + auth + storage + Realtime | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **OpenAI** | embeddings (`text-embedding-3-small`, 1536 dims) | `OPENAI_API_KEY`, `EMBEDDING_MODEL` |
| **Anthropic** | answers (`LLM_MODEL`) and figure captions (`FAST_MODEL`) | `ANTHROPIC_API_KEY` |
| **Inngest** | the job queue (app `tensorlm`) | production: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`; locally `INNGEST_DEV=1` |
| **Vercel** | web app | all web variables + Inngest keys |
| **Railway** | worker (≥ 4 GB RAM) | worker variables (see `.env.example`) |

Set a monthly spend limit on the OpenAI and Anthropic dashboards. Every variable is listed with a
comment in [`.env.example`](.env.example); copy it to `.env` at the repo root (the web app's
`apps/web/.env.local` is generated from it by `npm run dev` / `npm run build`).

## 3. Setup

```bash
git clone https://github.com/Hilal-11/tensorlm.git
cd tensorlm
cp .env.example .env                 # then fill it in

cd apps/web && npm install && cd ../..

cd services/worker
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt -r requirements-dev.txt   # Windows
# .venv/bin/python -m pip install -r requirements.txt -r requirements-dev.txt     # macOS/Linux
```

## 4. Database

Apply every migration in `supabase/migrations/` to your project, then regenerate types:

```bash
cd apps/web
npx supabase login
npx supabase link --project-ref <your-project-ref> --workdir ../..
npx supabase db push --workdir ../..
npm run db:types
```

## 5. Run locally (three processes)

```bash
# Terminal 1 — Inngest Dev Server (queue + dashboard at http://localhost:8288)
npx inngest-cli@1.53.0 dev --no-discovery \
  -u http://localhost:3000/api/inngest -u http://localhost:8000/api/inngest

# Terminal 2 — worker (the first parse loads Docling's models, about a minute)
cd services/worker
.venv/Scripts/python -m uvicorn app.main:app --port 8000        # macOS/Linux: .venv/bin/python
# check: http://localhost:8000/health and http://localhost:8000/ready

# Terminal 3 — web
cd apps/web
npm run dev                                                      # http://localhost:3000
```

`INNGEST_DEV=1` in `.env` makes both apps talk to the Dev Server without keys. Open
http://localhost:8288 to see runs, steps, retries and cancellations.

**Fully local (no cloud project):** `npx supabase start` (Docker), then `npm run dev:local` in
`apps/web` (port 3100, local stack keys injected, nothing written to `.env`) and start the worker
with the same keys: `node scripts/with-local-supabase.mjs --app <path-to-python> -m uvicorn
app.main:app --port 8000 --app-dir ../../services/worker`. Point the Dev Server at
`http://localhost:3100/api/inngest` instead of port 3000.

## 6. Checks

Web (`cd apps/web`):

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run e2e                 # Playwright (signed-out flows)
npm run test:rls            # database + RLS suite against the TEST project (.env.test)
npm run test:rls:local      # the same against the local stack
npm run e2e:local           # signed-in flows against `npm run dev:local`
```

Worker (`cd services/worker`):

```bash
.venv/Scripts/python -m pytest -q                         # all tests (Docling ones load models once)
.venv/Scripts/python -m pytest -q -m "not docling"        # fast unit tests only
.venv/Scripts/python -m pytest -q --cov=app               # coverage
```

The worker's integration test against Postgres runs with the local stack's keys:
`cd apps/web && node scripts/with-local-supabase.mjs --test <path-to-python> -m pytest -q -c
../../services/worker/pytest.ini ../../services/worker/tests/test_supabase_store.py`.

## 7. Deploy

**Web (Vercel):** import the repo, root directory `apps/web`, add every web variable from
`.env.example` plus `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` (no `INNGEST_DEV`).

**Worker (Railway, ≥ 4 GB RAM):** new service from the repo with the Dockerfile at
`services/worker/Dockerfile` and the **repo root** as build context (the image needs
`contracts/ingestion.json`). Add the worker variables (no `INNGEST_DEV`, no `WORKER_FAKE_AI`).
Health check path `/ready`. The image is multi-stage, pins every dependency, bakes in the Docling
and OCR models (`HF_HUB_OFFLINE=1`) and runs as a non-root user.

**Inngest:** create the app, then sync both endpoints:
`https://<your-domain>/api/inngest` (web) and `https://<worker-domain>/api/inngest` (worker).
Requests without a valid signature are rejected in production.

## Auth setup

Do these once in the dashboards; secrets go in `.env` only (never in chat or git).
Supabase callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`.

1. **Supabase → Authentication → URL Configuration**: Site URL `http://localhost:3000` (`https://tensorlm.io`
   at launch). Redirect URLs: `http://localhost:3000/**`, `https://tensorlm.io/**`, later your Vercel
   preview pattern.
2. **Email provider**: enabled, "Confirm email" on, minimum password length 8; leaked-password protection
   on if your plan has it.
3. **Email templates**: paste the four files from `docs/email-templates/`.
4. **SMTP (Resend)**: host `smtp.resend.com`, port 465, user `resend`, password = Resend API key, sender
   `hello@tensorlm.io` / `TensorLM`.
5. **Google** and **GitHub** OAuth apps with the Supabase callback URL; paste the IDs/secrets into
   Supabase → Providers. Turn on "Allow manual linking".
6. **Turnstile (optional)**: site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; secret in Supabase → Attack
   Protection.
7. **Test project**: a second Supabase project with all migrations applied and its keys in a repo-root
   `.env.test`: `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY`.

## Common problems

| Problem | Fix |
|---|---|
| Sources stay "Queued" | The Inngest Dev Server isn't running, or isn't pointed at the worker's `/api/inngest` |
| Worker `/ready` is 503 | Models are still loading (first start), or Supabase isn't reachable |
| First parse is slow locally | Docling loads its models once per process; later files are fast |
| `Invalid worker environment: …` | The named variables are missing; see `.env.example` |
| Embedding dimension error | `EMBEDDING_MODEL` must output 1536 dims to match `vector(1536)` |
