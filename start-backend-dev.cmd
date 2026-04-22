@echo off
echo Starting Procuro Backend Server...
cd /d %~dp0server
call npm run dev
pause

