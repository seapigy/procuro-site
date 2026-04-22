Write-Host "Prisma: migrate dev + generate" -ForegroundColor Cyan
Write-Host "Stop backend if migrations fail; press any key..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Set-Location (Join-Path $PSScriptRoot "server")
npx prisma migrate dev
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npx prisma generate
Write-Host "Done. Restart the backend." -ForegroundColor Green
