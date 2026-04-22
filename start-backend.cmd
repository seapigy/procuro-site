@echo off
echo Starting Procuro Backend Server...
echo.

cd /d "%~dp0server"

set TEST_MODE=true

echo Environment configured:
echo   TEST_MODE=%TEST_MODE%
echo   Working Directory: %CD%
echo.

echo Starting server...
npm run dev

pause





