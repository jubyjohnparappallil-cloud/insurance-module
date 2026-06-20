@echo off
title Launch Both Clinics
echo.
echo  ====================================================
echo    LAUNCHING BOTH CLINIC SERVERS
echo  ====================================================
echo.
echo  Starting Shanthi Medical Center   (port 3000)...
start "Shanthi Medical Center - Port 3000" cmd /k "cd /d "%~dp0" && color 0A && node server.js"

echo  Starting Shanthi Wellness Ayurveda (port 3001)...
start "Shanthi Wellness Ayurveda - Port 3001" cmd /k "cd /d "%~dp0" && color 0B && node server.js --wellness"

echo.
echo  Both servers are starting in separate windows.
echo.
echo  Shanthi Medical Center  --> http://localhost:3000
echo  Shanthi Wellness        --> http://localhost:3001
echo.
timeout /t 3
start http://localhost:3000
timeout /t 2
start http://localhost:3001
