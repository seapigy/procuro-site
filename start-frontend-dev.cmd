@echo off
echo Starting Procuro Frontend Client...
cd /d %~dp0client
call npm run dev
pause

