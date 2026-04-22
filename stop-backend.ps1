# Stop whatever is listening on port 5000 (typical API dev port)
$Port = 5000
Write-Host "Stopping process(es) on port $Port..." -ForegroundColor Cyan
$conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if (-not $conn) { Write-Host "No process on port $Port (already free)." -ForegroundColor Green; exit 0 }
$procIds = $conn | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($procId in $procIds) {
  $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if ($p) { Write-Host "  PID $procId - $($p.ProcessName)" -ForegroundColor Yellow }
}
foreach ($procId in $procIds) {
  try { Stop-Process -Id $procId -Force -ErrorAction Stop; Write-Host "  Stopped PID $procId" -ForegroundColor Green }
  catch { Write-Host "  Could not stop PID $procId : $($_.Exception.Message)" -ForegroundColor Red }
}
Write-Host "Waiting 3s for port release..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Write-Host "Done." -ForegroundColor Green
