# Run this script from your machine (PowerShell) to deploy migrations and verify.
# Requires: server/.env has DATABASE_URL with your real Supabase password.

$ErrorActionPreference = "Stop"
$serverRoot = Join-Path $PSScriptRoot ".."
Push-Location $serverRoot

Write-Host "1. Deploying migrations to Supabase..." -ForegroundColor Cyan
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Failed. Check: Supabase project not paused, DATABASE_URL in .env has correct password." -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "2. Generating Prisma client..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

Write-Host "3. Checking migration status..." -ForegroundColor Cyan
npx prisma migrate status
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

Write-Host "`nDone. Tables should now exist in Supabase (Table Editor)." -ForegroundColor Green
Write-Host "To start the backend: cd server; `$env:TEST_MODE='true'; npm run dev" -ForegroundColor Yellow
Write-Host "Then open: http://localhost:5000/health and http://localhost:5000/api/test/status" -ForegroundColor Yellow
Pop-Location
