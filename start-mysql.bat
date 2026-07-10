@echo off
REM Start MySQL Server
cd /d "C:\Program Files\MySQL\MySQL Server 8.0\bin"
echo Starting MySQL Server...
mysqld --install MySQL80 2>nul
net start MySQL80 2>nul
timeout /t 3
echo MySQL started
