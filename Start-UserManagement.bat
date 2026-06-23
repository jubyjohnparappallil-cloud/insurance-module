@echo off
title Shanthi Wellness - User Management
cd /d "%~dp0"
echo Starting User Management System on port 3002...
start http://localhost:3002
node server.js --usermgmt
pause
