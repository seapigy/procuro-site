@echo off
echo Starting ProcuroApp servers...
echo.

echo Starting Backend Server with TEST_MODE...
start "ProcuroApp Backend" cmd /k "cd server && set TEST_MODE=true && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting Frontend Client...
start "ProcuroApp Frontend" cmd /k "cd client && npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo ========================================
echo.
echo Opening browser...
timeout /t 5 /nobreak >nul

start http://localhost:5173

echo.
echo Both servers are starting!
echo Check the two new command windows for status.
echo.
pause







