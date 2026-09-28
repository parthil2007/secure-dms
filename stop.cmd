@echo off
rem ---------------------------------------------------------------
rem  SecureDMS - stop everything (API + Dashboard + Postgres)
rem ---------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" -Stop
pause
