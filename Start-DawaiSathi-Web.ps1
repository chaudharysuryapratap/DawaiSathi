param([switch]$NoOpenBrowser)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$stateDirectory = Join-Path $env:LOCALAPPDATA "DawaiSathi"
$logDirectory = Join-Path $stateDirectory "logs"
$stateFile = Join-Path $stateDirectory "launcher-processes.json"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

if (Test-Path $stateFile) {
    $script:trackedProcesses = @(Get-Content -Raw $stateFile | ConvertFrom-Json)
} else {
    $script:trackedProcesses = @()
}

function Save-TrackedProcesses {
    if ($script:trackedProcesses.Count -gt 0) {
        $script:trackedProcesses | ConvertTo-Json -Depth 4 | Set-Content -Path $stateFile -Encoding UTF8
    } elseif (Test-Path $stateFile) {
        Remove-Item -LiteralPath $stateFile -Force
    }
}

function Get-ListeningProcessId {
    param([int]$port)
    $connection = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($connection) {
        return [int]$connection.OwningProcess
    }
    return $null
}

function Wait-ForPort([int]$port, [System.Diagnostics.Process]$process, [string]$service) {
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if (Get-ListeningProcessId $port) {
            return
        }
        $process.Refresh()
        if ($process.HasExited) {
            $stdout = Join-Path $logDirectory "$service.stdout.log"
            $stderr = Join-Path $logDirectory "$service.stderr.log"
            if (Test-Path $stdout) { Get-Content $stdout -Tail 30 }
            if (Test-Path $stderr) { Get-Content $stderr -Tail 30 }
            throw "$service exited before port $port became available."
        }
        Start-Sleep -Seconds 1
    }
    throw "$service did not start listening on port $port within 60 seconds."
}

function Start-TrackedProcess {
    param(
        [string]$name,
        [string]$filePath,
        [string]$arguments,
        [string]$workingDirectory,
        [int]$port,
        [string]$commandMarker
    )
    $stdout = Join-Path $logDirectory "$name.stdout.log"
    $stderr = Join-Path $logDirectory "$name.stderr.log"
    $process = Start-Process `
        -FilePath $filePath `
        -ArgumentList $arguments `
        -WorkingDirectory $workingDirectory `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -WindowStyle Hidden `
        -PassThru
    $script:trackedProcesses += [pscustomobject]@{
        Name = $name
        Id = $process.Id
        Executable = $filePath
        CommandMarker = $commandMarker
        StartedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    }
    Save-TrackedProcesses
    Wait-ForPort $port $process $name
    Write-Host "$name is listening on port $port (PID $($process.Id))."
}

$dockerState = & docker inspect --format "{{.State.Running}}" dawaisathi-mongo 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "Could not inspect the existing 'dawaisathi-mongo' container. Start Docker Desktop and create/start this container before using the launcher; the launcher never recreates it."
}
if ("$dockerState".Trim() -ne "true") {
    Write-Host "Starting existing MongoDB container dawaisathi-mongo..."
    & docker start dawaisathi-mongo
    if ($LASTEXITCODE -ne 0) {
        throw "Docker could not start dawaisathi-mongo. The database was not reset or recreated."
    }
}

$backendPortOwner = Get-ListeningProcessId 8000
if (-not $backendPortOwner) {
    $python = Join-Path $root "backend\.venv\Scripts\python.exe"
    if (-not (Test-Path $python)) {
        throw "Backend Python was not found at $python. Create/restore backend\.venv before starting the app."
    }
    Start-TrackedProcess `
        "backend" `
        $python `
        "-m uvicorn server:app --app-dir `"$root\backend`" --host 0.0.0.0 --port 8000 --reload" `
        $root `
        8000 `
        "server:app --app-dir `"$root\backend`""
} else {
    Write-Host "Backend is already listening on port 8000 (PID $backendPortOwner); leaving it untouched."
}

$webPortOwner = Get-ListeningProcessId 8081
if (-not $webPortOwner) {
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $expoCli = Join-Path $root "frontend\node_modules\expo\bin\cli"
    if (-not (Test-Path $expoCli)) {
        throw "Expo CLI was not found at $expoCli. Install the frontend dependencies first."
    }
    Start-TrackedProcess `
        "expo-web" `
        $node `
        "`"$expoCli`" start --web --host 0.0.0.0 --port 8081" `
        (Join-Path $root "frontend") `
        8081 `
        "$expoCli"
} else {
    $webProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $webPortOwner"
    if ($webProcess.CommandLine -notmatch "expo") {
        throw "Port 8081 is already used by PID $webPortOwner, which is not an Expo process. Stop that service or configure Expo to use a different port."
    }
    Write-Host "Expo is already listening on port 8081 (PID $webPortOwner); leaving it untouched."
}

try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/" -TimeoutSec 5
    Write-Host "Backend health: $($health.message)"
} catch {
    throw "The backend port is open but its health endpoint failed: $($_.Exception.Message)"
}

$url = "http://localhost:8081"
Write-Host "DawaiSathi Web: $url"
Write-Host "Logs: $logDirectory"
if (-not $NoOpenBrowser) {
    Start-Process $url
}
