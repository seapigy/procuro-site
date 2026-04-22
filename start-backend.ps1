# Start Procuro backend (TEST_MODE, optional SQLite default, minimal .env bootstrap)
Write-Host "Starting Procuro Backend Server" -ForegroundColor Cyan
Set-Location (Join-Path $PSScriptRoot "server")
$env:TEST_MODE = "true"
if (-not $env:DATABASE_URL) { $env:DATABASE_URL = "file:./prisma/dev.db" }
if (-not (Test-Path ".env")) {
  @"
DATABASE_URL="file:./prisma/dev.db"
PORT=5000
NODE_ENV=development
"@ | Out-File -FilePath ".env" -Encoding UTF8
}
if (-not (Test-Path "node_modules")) { Write-Host "Run npm install in server/ first" -ForegroundColor Red; exit 1 }
npm run dev
