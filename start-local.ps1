# Starts TensorLM fully on this PC: local database, job queue, worker and web app.
#   Right-click > Run with PowerShell, or:  powershell -ExecutionPolicy Bypass -File .\start-local.ps1
# Then open http://localhost:3000  (emails for sign-up: http://localhost:54324)
# Needs Docker Desktop running. Each part opens in its own window; close a window to stop it.
# Uses fake embeddings and no captions (free). For real AI, start with:  -RealAI
param([switch]$RealAI)

$root = $PSScriptRoot
$web = Join-Path $root "apps\web"
$py = Join-Path $root "services\worker\.venv\Scripts\python.exe"

Write-Host "Starting the local database (first time takes a few minutes)..."
Push-Location $web
npx supabase start --workdir ../.. | Out-Null
Pop-Location

$fake = if ($RealAI) { "" } else { "`$env:WORKER_FAKE_AI='1';" }

Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "cd '$root'; npx --yes inngest-cli@1.53.0 dev --no-discovery -u http://localhost:3000/api/inngest -u http://localhost:8000/api/inngest"

Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "cd '$web'; `$env:INNGEST_DEV='1'; $fake node scripts/with-local-supabase.mjs --app '$py' -m uvicorn app.main:app --port 8000 --app-dir '$root\services\worker'"

Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "cd '$web'; node scripts/sync-pdfjs.mjs; `$env:INNGEST_DEV='1'; `$env:NEXT_PUBLIC_SITE_URL='http://localhost:3000'; node scripts/with-local-supabase.mjs --app npx next dev --port 3000"

Write-Host ""
Write-Host "Open http://localhost:3000  (give it ~30 s to compile the first time)"
Write-Host "Sign-up emails: http://localhost:54324   Job queue: http://localhost:8288"
