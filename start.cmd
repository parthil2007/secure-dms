@echo off
rem ---------------------------------------------------------------
rem  SecureDMS - start everything (Postgres + API + Dashboard)
rem  Just double-click this file. Press any key when finished.
rem ---------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
echo.
echo Dashboard will open at: http://localhost:5173
echo Close the two minimised windows (or run start.cmd -Stop) to shut down.
pause
