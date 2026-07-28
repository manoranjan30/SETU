param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$Username,

  [Parameter(Mandatory = $true)]
  [string]$Password,

  [string]$ProjectId = "7",
  [string]$CompanyId = "1",
  [string]$ActivityId = "1967",
  [string]$EpsNodeId = "410",
  [string]$ScenarioSet = "dashboard,progress-read,planning-read,design-read",
  [string]$SshTarget = "",
  [int]$StartVus = 5,
  [int]$EndVus = 100,
  [int]$StepVus = 5,
  [int]$DurationSeconds = 300,
  [int]$SampleIntervalSeconds = 10,
  [string]$OutputRoot = "",
  [switch]$SkipServerMetrics,
  [switch]$SkipPdf
)

$ErrorActionPreference = "Stop"

if ($BaseUrl -match '/api/?$') {
  throw "BaseUrl must be the backend root URL without /api. Example: http://202.21.35.57"
}
if ($StartVus -lt 1 -or $EndVus -lt $StartVus -or $StepVus -lt 1) {
  throw "Invalid VU range. Use values like -StartVus 5 -EndVus 100 -StepVus 5."
}
if ($DurationSeconds -lt 30) {
  throw "DurationSeconds should be at least 30 for useful capacity data."
}

function Assert-CommandExists {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found in PATH."
  }
}

function Get-MetricValues {
  param(
    $Summary,
    [string]$Name
  )
  $metrics = Get-ObjectProperty $Summary "metrics"
  $metric = Get-ObjectProperty $metrics $Name
  if ($null -eq $metric) { return @{} }
  $values = Get-ObjectProperty $metric "values"
  if ($values) { return $values }
  return $metric
}

function Get-ObjectProperty {
  param(
    $Object,
    [string]$Name
  )
  if ($null -eq $Object) { return $null }
  if ($Object -is [hashtable]) {
    if ($Object.ContainsKey($Name)) { return $Object[$Name] }
    return $null
  }
  $property = $Object.PSObject.Properties[$Name]
  if ($property) { return $property.Value }
  return $null
}

function Get-NumberOrDefault {
  param(
    $Value,
    [double]$Default = 0
  )
  if ($null -eq $Value) { return $Default }
  $parsed = 0.0
  if ([double]::TryParse([string]$Value, [ref]$parsed)) { return $parsed }
  return $Default
}

function Read-K6SummaryMetrics {
  param([string]$SummaryPath)
  if (-not (Test-Path -LiteralPath $SummaryPath)) {
    return $null
  }

  $summary = Get-Content -LiteralPath $SummaryPath -Raw | ConvertFrom-Json
  $duration = Get-MetricValues -Summary $summary -Name "http_req_duration"
  $failed = Get-MetricValues -Summary $summary -Name "http_req_failed"
  $checks = Get-MetricValues -Summary $summary -Name "checks"
  $requests = Get-MetricValues -Summary $summary -Name "http_reqs"

  return [ordered]@{
    avgMs = Get-NumberOrDefault (Get-ObjectProperty $duration "avg")
    p90Ms = Get-NumberOrDefault (Get-ObjectProperty $duration "p(90)")
    p95Ms = Get-NumberOrDefault (Get-ObjectProperty $duration "p(95)")
    p99Ms = Get-NumberOrDefault (Get-ObjectProperty $duration "p(99)")
    maxMs = Get-NumberOrDefault (Get-ObjectProperty $duration "max")
    failRate = Get-NumberOrDefault (Get-ObjectProperty $failed "rate")
    checkRate = Get-NumberOrDefault (Get-ObjectProperty $checks "rate")
    reqRate = Get-NumberOrDefault (Get-ObjectProperty $requests "rate")
    requests = Get-NumberOrDefault (Get-ObjectProperty $requests "count")
  }
}

function Format-Ms {
  param([double]$Value)
  if ($Value -ge 1000) { return ("{0:n2}s" -f ($Value / 1000)) }
  return ("{0:n0}ms" -f $Value)
}

function Format-Percent {
  param([double]$Value)
  return ("{0:n2}%" -f ($Value * 100))
}

function Start-ServerSampler {
  param(
    [string]$Target,
    [string]$OutputPath,
    [int]$IntervalSeconds
  )

  $remoteScript = @'
while true; do
  ts=$(date -Iseconds)
  load1=$(awk '{print $1}' /proc/loadavg)
  cpu_idle=$(top -bn1 | awk -F'id,' '/Cpu\(s\)/ { split($1,a,","); split(a[length(a)],b," "); print b[1] }')
  cpu_used=$(awk -v idle="$cpu_idle" 'BEGIN { if (idle == "") print ""; else printf "%.2f", 100 - idle }')
  mem_used_pct=$(free | awk '/Mem:/ { printf "%.2f", ($3/$2)*100 }')
  swap_used_pct=$(free | awk '/Swap:/ { if ($2 == 0) print "0.00"; else printf "%.2f", ($3/$2)*100 }')
  disk_used_pct=$(df -P / | awk 'NR==2 { gsub("%","",$5); print $5 }')
  app_stats=$(docker stats --no-stream --format '{{.CPUPerc}}|{{.MemPerc}}' setu_app 2>/dev/null | head -1 | tr -d '%')
  db_stats=$(docker stats --no-stream --format '{{.CPUPerc}}|{{.MemPerc}}' setu_postgres 2>/dev/null | head -1 | tr -d '%')
  app_cpu=$(echo "$app_stats" | awk -F'|' '{print $1}')
  app_mem=$(echo "$app_stats" | awk -F'|' '{print $2}')
  db_cpu=$(echo "$db_stats" | awk -F'|' '{print $1}')
  db_mem=$(echo "$db_stats" | awk -F'|' '{print $2}')
  printf "%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n" "$ts" "$load1" "$cpu_used" "$mem_used_pct" "$swap_used_pct" "$disk_used_pct" "$app_cpu" "$app_mem" "$db_cpu" "$db_mem"
  sleep SAMPLE_INTERVAL
done
'@

  $remoteScript = $remoteScript.Replace("SAMPLE_INTERVAL", [string]$IntervalSeconds)

  "timestamp,load1,cpu_used_pct,mem_used_pct,swap_used_pct,disk_used_pct,setu_app_cpu_pct,setu_app_mem_pct,setu_postgres_cpu_pct,setu_postgres_mem_pct" |
    Set-Content -LiteralPath $OutputPath -Encoding UTF8

  return Start-Job -Name "setu-server-sampler" -ScriptBlock {
    param($Target, $RemoteScript, $OutputPath)
    $RemoteScript | ssh $Target "bash -s" 2>$null | Add-Content -LiteralPath $OutputPath
  } -ArgumentList $Target, $remoteScript, $OutputPath
}

function Stop-ServerSampler {
  param($Job)
  if ($null -eq $Job) { return }
  Stop-Job -Job $Job -ErrorAction SilentlyContinue | Out-Null
  Receive-Job -Job $Job -ErrorAction SilentlyContinue | Out-Null
  Remove-Job -Job $Job -Force -ErrorAction SilentlyContinue | Out-Null
}

function Get-ServerMetricSummary {
  param([string]$CsvPath)
  if (-not (Test-Path -LiteralPath $CsvPath)) { return $null }
  $rows = @(Import-Csv -LiteralPath $CsvPath | Where-Object { $_.timestamp })
  if ($rows.Count -eq 0) { return $null }

  function StatsFor($Name) {
    $values = @($rows | ForEach-Object {
      $raw = $_.$Name
      $parsed = 0.0
      if ([double]::TryParse($raw, [ref]$parsed)) { $parsed }
    })
    if ($values.Count -eq 0) { return @{ avg = 0; max = 0 } }
    return @{
      avg = (($values | Measure-Object -Average).Average)
      max = (($values | Measure-Object -Maximum).Maximum)
    }
  }

  return [ordered]@{
    samples = $rows.Count
    cpu = StatsFor "cpu_used_pct"
    mem = StatsFor "mem_used_pct"
    swap = StatsFor "swap_used_pct"
    appCpu = StatsFor "setu_app_cpu_pct"
    appMem = StatsFor "setu_app_mem_pct"
    dbCpu = StatsFor "setu_postgres_cpu_pct"
    dbMem = StatsFor "setu_postgres_mem_pct"
  }
}

Assert-CommandExists "node"
if (-not $SkipServerMetrics -and $SshTarget) {
  Assert-CommandExists "ssh"
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeHost = ($BaseUrl -replace '^https?://', '' -replace '[^a-zA-Z0-9.-]', '_')
$runRoot = if ($OutputRoot) { $OutputRoot } else { Join-Path $scriptRoot "reports\capacity-$safeHost-$timestamp" }
$suiteRunner = Join-Path $scriptRoot "run-k6-suite.ps1"

New-Item -ItemType Directory -Path $runRoot -Force | Out-Null

Write-Host "SETU capacity step test" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl"
Write-Host "VU range: $StartVus to $EndVus by $StepVus"
Write-Host "Duration per step: $DurationSeconds seconds"
Write-Host "Scenarios: $ScenarioSet"
Write-Host "Output: $runRoot"
if ($SshTarget -and -not $SkipServerMetrics) {
  Write-Host "Server metrics: $SshTarget every $SampleIntervalSeconds seconds"
} else {
  Write-Host "Server metrics: skipped"
}
Write-Host ""

$results = @()

for ($vus = $StartVus; $vus -le $EndVus; $vus += $StepVus) {
  Write-Host ""
  Write-Host "=== Capacity step: $vus VUs ===" -ForegroundColor Cyan

  $stepRoot = Join-Path $runRoot ("vus-{0:D3}" -f $vus)
  New-Item -ItemType Directory -Path $stepRoot -Force | Out-Null
  $serverCsv = Join-Path $stepRoot "server-metrics.csv"

  [Environment]::SetEnvironmentVariable("VUS", [string]$vus, "Process")
  [Environment]::SetEnvironmentVariable("DURATION_SECONDS", [string]$DurationSeconds, "Process")

  $sampler = $null
  if ($SshTarget -and -not $SkipServerMetrics) {
    $sampler = Start-ServerSampler -Target $SshTarget -OutputPath $serverCsv -IntervalSeconds $SampleIntervalSeconds
    Start-Sleep -Seconds 2
  }

  try {
    $runnerArgs = @(
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", $suiteRunner,
      "-BaseUrl", $BaseUrl,
      "-Username", $Username,
      "-Password", $Password,
      "-ProjectId", $ProjectId,
      "-CompanyId", $CompanyId,
      "-ActivityId", $ActivityId,
      "-EpsNodeId", $EpsNodeId,
      "-ScenarioSet", $ScenarioSet,
      "-OutputDir", $stepRoot
    )
    if ($SkipPdf) { $runnerArgs += "-SkipPdf" }

    & powershell @runnerArgs
    $runnerExit = $LASTEXITCODE
  }
  finally {
    Stop-ServerSampler -Job $sampler
  }

  $latestRun = Get-ChildItem -LiteralPath $stepRoot -Directory |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $latestRun) {
    $results += [ordered]@{
      vus = $vus
      runnerExit = $runnerExit
      status = "no-run-folder"
      scenarios = @()
      server = Get-ServerMetricSummary -CsvPath $serverCsv
      runDir = ""
    }
    continue
  }

  $manifestPath = Join-Path $latestRun.FullName "suite-manifest.json"
  $scenarioRows = @()
  if (Test-Path -LiteralPath $manifestPath) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    foreach ($scenario in $manifest.scenarios) {
      $metrics = Read-K6SummaryMetrics -SummaryPath $scenario.summaryPath
      $scenarioRows += [ordered]@{
        name = $scenario.name
        exitCode = $scenario.exitCode
        status = $scenario.status
        metrics = $metrics
      }
    }
  }

  $results += [ordered]@{
    vus = $vus
    runnerExit = $runnerExit
    status = if ($runnerExit -eq 0) { "completed" } else { "completed-with-threshold-failures" }
    scenarios = $scenarioRows
    server = Get-ServerMetricSummary -CsvPath $serverCsv
    runDir = $latestRun.FullName
  }
}

$jsonPath = Join-Path $runRoot "capacity-step-results.json"
$results | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

$reportPath = Join-Path $runRoot "capacity-step-report.md"
$lines = @()
$lines += "# SETU Capacity Step Test Report"
$lines += ""
$lines += "- Generated: $((Get-Date).ToString("s"))"
$lines += "- Base URL: $BaseUrl"
$lines += "- VU range: $StartVus to $EndVus by $StepVus"
$lines += "- Duration per step: $DurationSeconds seconds"
$lines += "- Scenarios: $ScenarioSet"
$lines += "- Server metrics target: $(if ($SshTarget) { $SshTarget } else { "not collected" })"
$lines += ""
$lines += "## Summary By Step"
$lines += ""
$lines += "| VUs | Worst p95 | Worst failure | Total req/s | Avg CPU | Max CPU | Avg RAM | Max RAM | App CPU Max | DB CPU Max | Status |"
$lines += "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |"

foreach ($result in $results) {
  $scenarioMetrics = @($result.scenarios | Where-Object { $_.metrics })
  $worstP95 = if ($scenarioMetrics.Count) { (($scenarioMetrics | ForEach-Object { $_.metrics.p95Ms }) | Measure-Object -Maximum).Maximum } else { 0 }
  $worstFail = if ($scenarioMetrics.Count) { (($scenarioMetrics | ForEach-Object { $_.metrics.failRate }) | Measure-Object -Maximum).Maximum } else { 0 }
  $totalReqRate = if ($scenarioMetrics.Count) { (($scenarioMetrics | ForEach-Object { $_.metrics.reqRate }) | Measure-Object -Sum).Sum } else { 0 }
  $server = $result.server

  $avgCpu = if ($server) { "{0:n1}%" -f $server.cpu.avg } else { "n/a" }
  $maxCpu = if ($server) { "{0:n1}%" -f $server.cpu.max } else { "n/a" }
  $avgRam = if ($server) { "{0:n1}%" -f $server.mem.avg } else { "n/a" }
  $maxRam = if ($server) { "{0:n1}%" -f $server.mem.max } else { "n/a" }
  $appCpu = if ($server) { "{0:n1}%" -f $server.appCpu.max } else { "n/a" }
  $dbCpu = if ($server) { "{0:n1}%" -f $server.dbCpu.max } else { "n/a" }

  $lines += "| $($result.vus) | $(Format-Ms $worstP95) | $(Format-Percent $worstFail) | $("{0:n2}" -f $totalReqRate) | $avgCpu | $maxCpu | $avgRam | $maxRam | $appCpu | $dbCpu | $($result.status) |"
}

$lines += ""
$lines += "## Per Scenario"
$lines += ""
foreach ($result in $results) {
  $lines += "### $($result.vus) VUs"
  $lines += ""
  $lines += "| Scenario | Status | p95 | p99 | Failure | Checks | Req/s | Requests |"
  $lines += "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |"
  foreach ($scenario in $result.scenarios) {
    if (-not $scenario.metrics) {
      $lines += "| $($scenario.name) | missing-summary | n/a | n/a | n/a | n/a | n/a | n/a |"
      continue
    }
    $lines += "| $($scenario.name) | $($scenario.status) | $(Format-Ms $scenario.metrics.p95Ms) | $(Format-Ms $scenario.metrics.p99Ms) | $(Format-Percent $scenario.metrics.failRate) | $(Format-Percent $scenario.metrics.checkRate) | $("{0:n2}" -f $scenario.metrics.reqRate) | $("{0:n0}" -f $scenario.metrics.requests) |"
  }
  $lines += ""
}

$lines += "## How To Read This"
$lines += ""
$lines += "- VUs are concurrent virtual users generated by k6."
$lines += "- Worst p95 is the slowest p95 latency among scenarios at that step."
$lines += "- Worst failure is the highest HTTP failure rate among scenarios at that step."
$lines += "- A practical pass target is p95 under 2 seconds, HTTP failures under 1%, CPU under 75-80%, and RAM under 80%."
$lines += "- If CPU is high, add CPU or app replicas. If DB CPU is high, tune queries/indexes or move Postgres to a stronger/separate server. If failures rise while CPU is low, inspect app and nginx logs."
$lines += ""
$lines += "## Output Files"
$lines += ""
$lines += "- Raw JSON: $jsonPath"
$lines += "- Step report: $reportPath"
$lines += "- Each VU folder contains k6 summaries, console logs, and server-metrics.csv when SSH metrics are enabled."

$lines -join "`n" | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host ""
Write-Host "Capacity step test complete." -ForegroundColor Green
Write-Host "Report: $reportPath"
Write-Host "Raw JSON: $jsonPath"
