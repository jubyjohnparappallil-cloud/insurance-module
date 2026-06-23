@echo off
title Shanthi Wellness - Insurance System
cd /d "%~dp0"
echo Starting Insurance System on port 3000...
start http://localhost:3000
node server.js
pause
