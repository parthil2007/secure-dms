# Portable tool paths used by SecureDMS on this machine.
# Source this file at the start of a session:
#   . .\env.ps1

$env:SDMS_ROOT = "C:\Users\mehta\OneDrive\Documents\Default Project"
$env:SDMS_NODE = "C:\Users\mehta\AppData\Local\opencode-tools\node-v24.19.0-win-x64"
$env:SDMS_PG   = "C:\Users\mehta\AppData\Local\opencode-tools\pgsql\pgsql"
$env:SDMS_DATA = "C:\Users\mehta\AppData\Local\opencode-tools\pgsql\data"
$env:SDMS_LOG  = "C:\Users\mehta\AppData\Local\opencode-tools\pgsql\server.log"

$env:PATH = "$env:SDMS_NODE;$env:SDMS_PG\bin;$env:PATH"

function Start-Postgres {
    & "$env:SDMS_PG\bin\pg_ctl.exe" -D $env:SDMS_DATA -l $env:SDMS_LOG -o "-p 5432" start
}

function Stop-Postgres {
    & "$env:SDMS_PG\bin\pg_ctl.exe" -D $env:SDMS_DATA stop
}

function Start-Api {
    Push-Location "$env:SDMS_ROOT\backend"
    node --watch --watch-path=src src/server.js
    Pop-Location
}

function Start-Web {
    Push-Location "$env:SDMS_ROOT\frontend"
    npm run dev
    Pop-Location
}

Write-Host "SecureDMS environment loaded." -ForegroundColor Cyan
Write-Host "  Start-Postgres | Start-Api | Start-Web"
