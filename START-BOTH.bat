@echo off
title Shanthi Wellness - Starting Both Systems
cd /d "%~dp0"
echo Starting both systems...
start "Insurance System" cmd /k "cd /d %~dp0 && node server.js"
timeout /t 2 >nul
start "User Management" cmd /k "cd /d %~dp0 && node server.js --usermgmt"
timeout /t 3 >nul
start http://localhost:3000
start http://localhost:3002
echo.
echo Both systems running!
echo Insurance:       http://localhost:3000
echo User Management: http://localhost:3002
echo.
echo Close this window to keep both running.
pause
