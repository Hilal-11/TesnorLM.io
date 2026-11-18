# TensorLM

Upload any paper. Understand it deeply. AI explanations with diagrams, examples, math and citations.

```
tensorlm/
├── apps/web/                 # Next.js app (created by setup script)
├── templates/web/            # TensorLM starter files copied into apps/web
├── services/worker/          # Python FastAPI worker: parsing (Docling) + embeddings
├── supabase/migrations/      # Postgres schema, pgvector, hybrid search, RLS, storage
├── scripts/setup.sh          # one-time setup
└── .env.example
```

## How it works

```
Browser ──upload──▶ Supabase Storage
   │
   └─POST /api/documents ─▶ Next.js ─▶ Worker /ingest
                                         ├─ Docling: PDF → Markdown (tables, LaTeX)
                                         ├─ heading-aware chunking (+ section context)
                                         ├─ OpenAI embeddings
                                         └─ Postgres: chunks (pgvector + full-text)

Browser ──question──▶ /api/chat
                         ├─ small notebook? → send full documents (no RAG needed)
                         ├─ else → hybrid_search() (vector + BM25, RRF fusion)
                         └─ Claude streams answer: markdown + $math$ + ```mermaid + ```chart
                              └─ LessonRenderer renders it
```

---

## 1. Install these on your machine

| Tool | Version | Check |
|---|---|---|
| Node.js | 20 LTS or newer | `node -v` |
| Python | 3.11 or 3.12 | `python3 --version` |
| Git | any | `git --version` |
| Docker Desktop | optional (only to run worker in a container / local Supabase) | `docker -v` |
| VS Code + extensions | ESLint, Prettier, Tailwind CSS IntelliSense, Python, Pylance | |

## 2. Create these accounts and keys

| Service | Why | Where to get key |
|---|---|---|
| **Supabase** | Postgres + pgvector + auth + storage | supabase.com → New project → Settings → API |
| **Anthropic** | main LLM for answers/lessons | console.anthropic.com |
| **OpenAI** | embeddings | platform.openai.com |
| **GitHub** | repo | `Hilal-11/tensorlm` |
| **Vercel** | deploy web app | vercel.com (import repo) |
| **Railway / Fly.io / Render** | deploy Python worker | railway.app |

Later (phase 2): Cohere (rerank), E2B (code sandbox), Langfuse (tracing), Upstash Redis (cache/rate limit), Razorpay.

> 💡 Set a monthly spend limit on Anthropic and OpenAI dashboards before you start.

## 3. Setup

```bash
git clone https://github.com/Hilal-11/tensorlm.git
cd tensorlm
bash scripts/setup.sh          # creates apps/web, installs everything, sets up Python venv
```

Fill in `.env` (copied from `.env.example`). `apps/web/.env.local` is a symlink to it.

## 4. Database

```bash
cd apps/web
npx supabase login
npx supabase link --project-ref <your-project-ref>     # ref is in your Supabase URL
npx supabase db push --workdir ../..                  # runs supabase/migrations/0001_init.sql
```

Or paste `supabase/migrations/0001_init.sql` into the Supabase SQL editor and run it.

In Supabase dashboard → Authentication → Providers: enable **Email** and **Google**.

## 5. Run locally (two terminals)

```bash
# Terminal A — worker  (first run downloads Docling models, takes a few minutes)
cd services/worker
.venv/bin/uvicorn app.main:app --reload --port 8000
# check: http://localhost:8000/health

# Terminal B — web
cd apps/web
npm run dev
# http://localhost:3000
```

Add `@tailwindcss/typography` to your Tailwind CSS file so lesson text looks good:

```css
/* apps/web/src/app/globals.css */
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

## 6. What's already built vs. what you build next

**Included in this starter**
- [x] Schema: notebooks, documents, chunks, figures, chats, messages, lessons + RLS
- [x] Hybrid search SQL function (vector + keyword, RRF)
- [x] Private storage bucket with per-user folders
- [x] Worker: download → Docling parse → structure-aware chunking → embeddings → store
- [x] `/api/documents` — register upload + trigger ingestion
- [x] `/api/chat` — adaptive routing (full-context vs retrieval) + streaming Claude answer
- [x] `LessonRenderer` — markdown + KaTeX + Mermaid + Recharts

**Build next (MVP)**
- [ ] Auth pages (login / signup) + middleware session refresh
- [ ] Notebook list + upload UI (upload to `documents/<user_id>/<doc_id>/<file>`, then POST `/api/documents`)
- [ ] Document status polling (or Supabase Realtime on `documents.status`)
- [ ] Chat UI that reads the text stream and renders with `LessonRenderer`
- [ ] Citation chips → open PDF viewer at the source section
- [ ] Eval set: 30–50 real questions on 5 papers, run after every change

**Phase 2**
- [ ] Reranking (Cohere) in `retrieve()`
- [ ] Figure extraction + vision captions → `figures` table
- [ ] Structured lesson generator (JSON blocks) saved to `lessons`
- [ ] Worked examples executed in E2B sandbox
- [ ] Quizzes / flashcards
- [ ] Langfuse tracing, Upstash rate limits, Razorpay plans
- [ ] Move ingestion to Inngest / Trigger.dev queue

## 7. Deploy

- **Web:** push to GitHub → import in Vercel → set root directory `apps/web` → add env vars.
- **Worker:** Railway → New service from repo → root `services/worker` → it detects the Dockerfile → add env vars → copy the public URL into `WORKER_URL` on Vercel.
- Worker needs ~2 GB RAM for Docling. Start with the smallest plan that has that.

## Common problems

| Problem | Fix |
|---|---|
| Worker first request is very slow | Docling downloads its models once; later runs are fast |
| `libGL.so.1` error | `sudo apt install libgl1 libglib2.0-0` (Linux) — already in Dockerfile |
| `hybrid_search` returns nothing | document status must be `ready`; check `chunks` table has rows |
| 401 from `/api/chat` | user isn't logged in — build auth pages first |
| Embedding dimension error | `EMBEDDING_MODEL` must output 1536 dims to match `vector(1536)` |
