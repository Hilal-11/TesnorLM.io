# Starts TensorLM on this PC against your Supabase cloud project (Google + GitHub sign-in work):
#   powershell -ExecutionPolicy Bypass -File .\start.ps1
# Then open http://localhost:3000   Job queue: http://localhost:8288
# Uses the keys in the repo-root .env. Each part opens in its own window; close it to stop it.
# (start-local.ps1 does the same on a local Docker database instead.)
$root = $PSScriptRoot

Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "cd '$root'; npx --yes inngest-cli@1.53.0 dev --no-discovery -u http://localhost:3000/api/inngest -u http://localhost:8000/api/inngest"

Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "cd '$root\services\worker'; `$env:INNGEST_DEV='1'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"

Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "cd '$root\apps\web'; `$env:INNGEST_DEV='1'; npm run dev"

Write-Host "Open http://localhost:3000  (give it ~30 s to compile the first time)"
