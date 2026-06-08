param(
  [switch]$KeepDatabase
)

$ErrorActionPreference = 'Continue'

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$PidFile = Join-Path $Root '.run\services.json'

function Stop-Pid([object]$ProcessId, [string]$Name) {
  if (-not $ProcessId) { return }
  $process = Get-Process -Id ([int]$ProcessId) -ErrorAction SilentlyContinue
  if ($process) {
    Write-Host "Stopping $Name PID $ProcessId..."
    Stop-Process -Id ([int]$ProcessId) -Force -ErrorAction SilentlyContinue
  }
}

if (Test-Path -LiteralPath $PidFile) {
  $state = Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json
  Stop-Pid $state.web.pid 'web'
  Stop-Pid $state.api.pid 'api'
  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
} else {
  Write-Host 'No state file found. Falling back to known ports.'
}

foreach ($port in 5173, 3001) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    Stop-Pid $connection.OwningProcess "port $port"
  }
}

if (-not $KeepDatabase) {
  Write-Host 'Stopping PostgreSQL container...'
  docker compose -f (Join-Path $Root 'docker-compose.yml') stop postgres | Out-Host
} else {
  Write-Host 'Keeping PostgreSQL container running.'
}

Write-Host 'Services stopped.'
