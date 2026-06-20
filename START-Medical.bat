@echo off
title Shanthi Medical Center - Port 3000
color 0A
echo.
echo  ====================================================
echo    SHANTHI MEDICAL CENTER
echo    Server starting on port 3000
echo    Open browser: http://localhost:3000
echo  ====================================================
echo.
cd /d "%~dp0"
node server.js
pause
