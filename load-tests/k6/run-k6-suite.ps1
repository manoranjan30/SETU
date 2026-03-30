param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Username = "admin",
  [string]$Password = "admin",
  [string]$ProjectId = "2",
  [string]$CompanyId = "1",
  [string]$ActivityId = "1967",
  [string]$EpsNodeId = "410",
  [string]$ScenarioSet = "core-read",
  [string]$OutputDir = "",
  [string]$ProgressPayloadFile = "",
  [switch]$SkipPdf
)

$ErrorActionPreference = "Stop"

if ($BaseUrl -match '/api/?$') {
  throw "BASE_URL must be the backend root URL without /api. Example: http://localhost:3000"
}

function Assert-CommandExists {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found in PATH."
  }
}

function Ensure-NodeAvailable {
  Assert-CommandExists "node"
}

function Ensure-K6Executable {
  $cmd = Get-Command "k6" -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  $bootstrapScript = Join-Path $PSScriptRoot "scripts\bootstrap-k6.ps1"
  $localK6 = Join-Path $PSScriptRoot "tools\k6\current\k6.exe"
  if (-not (Test-Path $bootstrapScript)) {
    throw "k6 is not installed and bootstrap script was not found: $bootstrapScript"
  }

  Write-Host "k6 not found in PATH. Bootstrapping local k6..." -ForegroundColor Yellow
  $null = & powershell -NoProfile -ExecutionPolicy Bypass -File $bootstrapScript
  if ($LASTEXITCODE -ne 0) {
    throw "k6 bootstrap failed."
  }

  if (-not (Test-Path $localK6)) {
    throw "k6 bootstrap finished but k6.exe was not found at $localK6"
  }
  return $localK6
}

function Get-ScenarioNames {
  param([string]$SetName)

  $sets = @{
    "smoke"      = @("smoke-auth")
    "dashboards" = @("dashboard")
    "progress"   = @("progress-read")
    "planning"   = @("planning-read")
    "documents"  = @("design-read")
    "mixed"      = @("mixed-read")
    "writes"     = @("progress-write-approve")
    "core-read"  = @("smoke-auth", "dashboard", "progress-read", "planning-read", "design-read", "mixed-read")
    "all"        = @("smoke-auth", "dashboard", "progress-read", "planning-read", "design-read", "mixed-read", "progress-write-approve")
  }

  if ($sets.ContainsKey($SetName)) {
    return $sets[$SetName]
  }

  return $SetName.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

function New-RunDirectory {
  param([string]$RootDir)
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $runDir = Join-Path $RootDir $timestamp
  New-Item -ItemType Directory -Path $runDir -Force | Out-Null
  return $runDir
}

Ensure-NodeAvailable
$k6Executable = Ensure-K6Executable

$reportsRoot = if ($OutputDir) { $OutputDir } else { Join-Path $PSScriptRoot "reports" }
$progressPayloadPath = if ($ProgressPayloadFile) { $ProgressPayloadFile } else { Join-Path $PSScriptRoot "payloads\progress-entry.auto.json" }

New-Item -ItemType Directory -Path $reportsRoot -Force | Out-Null
$runDir = New-RunDirectory -RootDir $reportsRoot
$scenarioNames = Get-ScenarioNames -SetName $ScenarioSet

$envMap = @{
  BASE_URL = $BaseUrl
  K6_USERNAME = $Username
  K6_PASSWORD = $Password
  PROJECT_ID = $ProjectId
  COMPANY_ID = $CompanyId
  ACTIVITY_ID = $ActivityId
  EPS_NODE_ID = $EpsNodeId
  PROGRESS_WRITE_PAYLOAD_FILE = $progressPayloadPath
}

$previousEnv = @{}
foreach ($entry in $envMap.GetEnumerator()) {
  $previousEnv[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, "Process")
  [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
}

$manifest = [ordered]@{
  generatedAt = (Get-Date).ToString("s")
  baseUrl = $BaseUrl
  scenarioSet = $ScenarioSet
  runDirectory = $runDir
  environment = [ordered]@{
    projectId = $ProjectId
    companyId = $CompanyId
    activityId = $ActivityId
    epsNodeId = $EpsNodeId
  }
  scenarios = @()
}

try {
  foreach ($scenarioName in $scenarioNames) {
    $scenarioPath = Join-Path $PSScriptRoot ("scenarios\" + $scenarioName + ".js")
    if (-not (Test-Path $scenarioPath)) {
      throw "Scenario file not found: $scenarioPath"
    }

    $summaryPath = Join-Path $runDir ($scenarioName + "-summary.json")
    $stdoutPath = Join-Path $runDir ($scenarioName + "-stdout.txt")

    Write-Host ""
    Write-Host ("=== Running scenario: " + $scenarioName + " ===") -ForegroundColor Cyan

    $stderrPath = Join-Path $runDir ($scenarioName + "-stderr.txt")
    $arguments = ('run --summary-export "{0}" "{1}"' -f $summaryPath, $scenarioPath)
    $process = Start-Process -FilePath $k6Executable `
      -ArgumentList $arguments `
      -NoNewWindow `
      -PassThru `
      -Wait `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath
    $exitCode = $process.ExitCode

    if (Test-Path $stdoutPath) {
      Get-Content -Path $stdoutPath
    }
    if (Test-Path $stderrPath) {
      $stderrContent = Get-Content -Path $stderrPath
      if ($stderrContent) {
        $stderrContent | Add-Content -Path $stdoutPath
        $stderrContent | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
      }
    }

    $manifest.scenarios += [ordered]@{
      name = $scenarioName
      scenarioPath = $scenarioPath
      summaryPath = $summaryPath
      stdoutPath = $stdoutPath
      stderrPath = $stderrPath
      exitCode = $exitCode
      status = if ($exitCode -eq 0) { "passed" } else { "failed" }
    }

    if ($exitCode -ne 0) {
      Write-Warning ("Scenario failed: " + $scenarioName + " (exit code " + $exitCode + ")")
    }
  }
}
finally {
  foreach ($entry in $previousEnv.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
  }
}

$failedScenarios = @($manifest.scenarios | Where-Object { $_.exitCode -ne 0 })

$manifestPath = Join-Path $runDir "suite-manifest.json"
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Path $manifestPath -Encoding UTF8

$markdownPath = Join-Path $runDir "load-test-report.md"
$pdfPath = Join-Path $runDir "load-test-report.pdf"

$reportArgs = @(
  (Join-Path $PSScriptRoot "scripts\generate-k6-report.cjs"),
  "--manifest", $manifestPath,
  "--markdown", $markdownPath,
  "--pdf", $pdfPath
)
if ($SkipPdf) {
  $reportArgs += "--skip-pdf"
}

& node @reportArgs
if ($LASTEXITCODE -ne 0) {
  throw "Report generation failed."
}

Write-Host ""
Write-Host "Load test run completed." -ForegroundColor Green
if ($failedScenarios.Count -gt 0) {
  Write-Warning ("Some scenarios crossed thresholds or failed: " + (($failedScenarios | ForEach-Object { $_.name }) -join ", "))
}
Write-Host ("Run directory: " + $runDir)
Write-Host ("Manifest: " + $manifestPath)
Write-Host ("Markdown report: " + $markdownPath)
if (-not $SkipPdf) {
  Write-Host ("PDF report: " + $pdfPath)
}
