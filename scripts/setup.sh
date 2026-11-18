#!/usr/bin/env bash
# TensorLM one-time setup. Run from the repo root:  bash scripts/setup.sh
set -euo pipefail

echo "▶ 1/4  Creating Next.js app in apps/web"
mkdir -p apps
npx create-next-app@latest apps/web --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --yes

echo "▶ 2/4  Installing web dependencies"
cd apps/web
npm install ai @ai-sdk/anthropic @ai-sdk/openai openai zod \
  @supabase/supabase-js @supabase/ssr \
  react-markdown remark-gfm remark-math rehype-katex katex mermaid recharts
npm install -D @tailwindcss/typography supabase
npx shadcn@latest init -d
cd ../..

echo "▶ 3/4  Copying TensorLM starter files into apps/web"
cp -R templates/web/. apps/web/
[ -f .env ] || cp .env.example .env
ln -sf ../../.env apps/web/.env.local

echo "▶ 4/4  Setting up Python worker venv"
cd services/worker
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt
cd ../..

echo ""
echo "✅ Done. Next:"
echo "   1. Fill in .env with your keys"
echo "   2. npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push"
echo "   3. Terminal A: cd services/worker && .venv/bin/uvicorn app.main:app --reload"
echo "   4. Terminal B: cd apps/web && npm run dev"
