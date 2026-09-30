$ErrorActionPreference = "Stop"
$stateFile = Join-Path $env:LOCALAPPDATA "DawaiSathi\launcher-processes.json"
if (-not (Test-Path $stateFile)) {
    Write-Host "No launcher-owned processes are recorded; existing services were left running."
    exit 0
}

$entries = @(Get-Content -Raw $stateFile | ConvertFrom-Json)
$allProcesses = @(Get-CimInstance Win32_Process)
$ownedRoots = @()
foreach ($entry in $entries) {
    $process = $allProcesses | Where-Object { $_.ProcessId -eq [int]$entry.Id } | Select-Object -First 1
    if (
        $process -and
        $process.CommandLine.Contains($entry.CommandMarker)
    ) {
        $ownedRoots += $process
    }
}

$ownedIds = [System.Collections.Generic.HashSet[int]]::new()
$pendingIds = [System.Collections.Generic.Queue[int]]::new()
foreach ($rootProcess in $ownedRoots) {
    [void]$ownedIds.Add([int]$rootProcess.ProcessId)
    $pendingIds.Enqueue([int]$rootProcess.ProcessId)
}
while ($pendingIds.Count -gt 0) {
    $parentId = $pendingIds.Dequeue()
    foreach ($child in $allProcesses | Where-Object { $_.ParentProcessId -eq $parentId }) {
        if ($ownedIds.Add([int]$child.ProcessId)) {
            $pendingIds.Enqueue([int]$child.ProcessId)
        }
    }
}

$toStop = @($ownedIds)
[array]::Reverse($toStop)
foreach ($processId in $toStop) {
    if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
        Stop-Process -Id $processId -Force
        Write-Host "Stopped launcher-owned process $processId."
    }
}

Remove-Item -LiteralPath $stateFile -Force
Write-Host "MongoDB was not stopped. Processes that were already running before the launcher were left untouched."
