<#
.SYNOPSIS
    Starts (or stops) the complete SecureDMS stack: PostgreSQL + API + dashboard.

.EXAMPLE
    .\start.ps1              # start everything (Postgres, API :5000, dashboard :5173)
    .\start.ps1 -Stop        # stop everything again
    .\start.ps1 -ApiOnly     # just Postgres + API

    Each service opens in its own minimised window so closing this script
    (or the agent session) does not take the stack down with it.
#>
param(
    [switch]$Stop,
    [switch]$ApiOnly,
    [switch]$WebOnly
)

$ErrorActionPreference = 'Stop'

# --- portable tool paths -----------------------------------------------------
$Node  = "C:\Users\mehta\AppData\Local\opencode-tools\node-v24.19.0-win-x64"
$Pg    = "C:\Users\mehta\AppData\Local\opencode-tools\pgsql\pgsql"
$Data  = "C:\Users\mehta\AppData\Local\opencode-tools\pgsql\data"
$PgLog = "C:\Users\mehta\AppData\Local\opencode-tools\pgsql\server.log"
$Root  = Split-Path -Parent $MyInvocation.MyCommand.Path

$env:PATH = "$Node;$Pg\bin;$env:PATH"

function Test-Port([int]$Port) {
    (Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -WarningAction SilentlyContinue).TcpTestSucceeded
}

function Stop-Sdms {
    Write-Host "Stopping SecureDMS processes..." -ForegroundColor Yellow

    # Only our own node processes — never every node.exe on the machine.
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'src[\\/]server\.js|node_modules[\\/]vite[\\/]' } |
        ForEach-Object {
            Write-Host "  killing pid $($_.ProcessId)"
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }

    $pgStatus = & "$Pg\bin\pg_ctl.exe" -D $Data status 2>&1
    if ($LASTEXITCODE -eq 0) {
        & "$Pg\bin\pg_ctl.exe" -D $Data -m fast stop | Out-Null
        Write-Host "  postgres stopped"
    } else {
        Write-Host "  postgres was not running"
    }
    Write-Host "Done." -ForegroundColor Green
}

if ($Stop) { Stop-Sdms; exit 0 }

# --- 1. PostgreSQL -----------------------------------------------------------
& "$Pg\bin\pg_ctl.exe" -D $Data status 2>&1 | Out-Null
$running = ($LASTEXITCODE -eq 0)
if (-not $running) {
    Write-Host "Starting PostgreSQL (port 5432)..." -NoNewline
    & "$Pg\bin\pg_ctl.exe" -D $Data -l $PgLog -o "-p 5432" start | Out-Null
    Write-Host " ok" -ForegroundColor Green
} else {
    Write-Host "PostgreSQL already running" -ForegroundColor DarkGray
}

# --- 2. Backend API ----------------------------------------------------------
if (-not $WebOnly) {
    if (Test-Port 5000) {
        Write-Host "API already listening on :5000" -ForegroundColor DarkGray
    } else {
        Write-Host "Starting API on :5000..." -ForegroundColor Cyan
        $apiCmd = "Set-Location '$Root\backend'; `$env:PATH='$Node;'+`$env:PATH; node --watch --watch-path=src src/server.js"
        Start-Process powershell -ArgumentList '-NoExit', '-Command', $apiCmd -WindowStyle Minimized
    }
}

# --- 3. Frontend dev server --------------------------------------------------
if (-not $ApiOnly) {
    if (Test-Port 5173) {
        Write-Host "Dashboard already listening on :5173" -ForegroundColor DarkGray
    } else {
        Write-Host "Starting dashboard on :5173..." -ForegroundColor Cyan
        $webCmd = "Set-Location '$Root\frontend'; `$env:PATH='$Node;'+`$env:PATH; npm run dev"
        Start-Process powershell -ArgumentList '-NoExit', '-Command', $webCmd -WindowStyle Minimized
    }
}

# --- 4. Wait for health ------------------------------------------------------
Write-Host ""
$deadline = (Get-Date).AddSeconds(30)
$apiOk = $false; $webOk = $false
while ((Get-Date) -lt $deadline -and -not ($apiOk -and $webOk)) {
    if (-not $apiOk) { $apiOk = Test-Port 5000 }
    if (-not $webOk) { $webOk = Test-Port 5173 }
    if (-not ($apiOk -and $webOk)) { Start-Sleep -Milliseconds 750 }
}

if ($apiOk) {
    try {
        $h = Invoke-RestMethod "http://localhost:5000/api/health" -TimeoutSec 3
        Write-Host "  API       http://localhost:5000/api   [$($h.status)]" -ForegroundColor Green
    } catch { Write-Host "  API       :5000 open but health failed" -ForegroundColor Yellow }
} else {
    Write-Host "  API       did not come up — check the backend window" -ForegroundColor Red
}

if ($webOk) { Write-Host "  Dashboard http://localhost:5173" -ForegroundColor Green }
elseif (-not $ApiOnly) { Write-Host "  Dashboard did not come up — check the frontend window" -ForegroundColor Red }

Write-Host ""
Write-Host "Login: admin@secure-dms.gov.in  /  SecureDms@2026" -ForegroundColor DarkCyan
