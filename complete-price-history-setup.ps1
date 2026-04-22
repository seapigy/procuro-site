Write-Host "Price history: Prisma generate" -ForegroundColor Cyan
Write-Host "Stop backend if DB locked; press any key..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Set-Location (Join-Path $PSScriptRoot "server")
npx prisma generate
if ($LASTEXITCODE -eq 0) { Write-Host "Done." -ForegroundColor Green }
