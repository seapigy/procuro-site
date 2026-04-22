@echo off
echo Running Matching Upgrade Verification...
cd /d %~dp0server
set API_BASE_URL=http://localhost:5000
call npm run verify:matching
pause

