Write-Host "Force-generating Prisma client" -ForegroundColor Cyan
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
  foreach ($proc in $nodeProcesses) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  Write-Host "Stopped $($nodeProcesses.Count) Node process(es)" -ForegroundColor Yellow
}
Start-Sleep -Seconds 5
$serverDir = Join-Path $PSScriptRoot "server"
Set-Location $serverDir
npx prisma generate
if ($LASTEXITCODE -eq 0) { Write-Host "Success. Restart the backend." -ForegroundColor Green }
else { Write-Host "Try closing editors and: cd server; npx prisma generate" -ForegroundColor Yellow }
