@echo off
title Shanthi Wellness Ayurveda - Port 3001
color 0B
echo.
echo  ====================================================
echo    SHANTHI WELLNESS AYURVEDIC LLC
echo    Server starting on port 3001
echo    Open browser: http://localhost:3001
echo  ====================================================
echo.
cd /d "%~dp0"
node server.js --wellness
pause
