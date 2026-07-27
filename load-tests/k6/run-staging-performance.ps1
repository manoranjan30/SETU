param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$Username,

  [Parameter(Mandatory = $true)]
  [string]$Password,

  [string]$ProjectId = "2",
  [string]$CompanyId = "1",
  [string]$ActivityId = "1967",
  [string]$EpsNodeId = "410",
  [string]$ScenarioSet = "smoke-auth,dashboard,progress-read,planning-read,design-read",
  [string]$OutputRoot = "",
  [switch]$IncludeMixedRead,
  [switch]$SkipPdf
)

$ErrorActionPreference = "Stop"

if ($BaseUrl -match '/api/?$') {
  throw "BaseUrl must be the backend root URL without /api. Example: https://staging-api.example.com"
}

if ($BaseUrl -match 'localhost|127\.0\.0\.1') {
  Write-Warning "BaseUrl points to a local machine, not staging: $BaseUrl"
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..\..")
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeHost = ($BaseUrl -replace '^https?://', '' -replace '[^a-zA-Z0-9.-]', '_')
$reportsRoot = if ($OutputRoot) { $OutputRoot } else { Join-Path $scriptRoot "reports\staging-$safeHost" }

if ($IncludeMixedRead -and ($ScenarioSet -notmatch 'mixed-read')) {
  $ScenarioSet = "$ScenarioSet,mixed-read"
}

Write-Host "SETU staging performance run" -ForegroundColor Cyan
Write-Host "Backend URL: $BaseUrl"
Write-Host "Scenario set: $ScenarioSet"
Write-Host "Reports root: $reportsRoot"
Write-Host ""
Write-Host "Safety note: mixed-read ramps up to 300 VUs. Use -IncludeMixedRead only for an approved load-test window." -ForegroundColor Yellow
Write-Host ""

$runner = Join-Path $scriptRoot "run-k6-suite.ps1"
$runnerArgs = @(
  "-NoProfile",
  "-ExecutionPolicy", "BYPASS",
  "-File", $runner,
  "-BaseUrl", $BaseUrl,
  "-Username", $Username,
  "-Password", $Password,
  "-ProjectId", $ProjectId,
  "-CompanyId", $CompanyId,
  "-ActivityId", $ActivityId,
  "-EpsNodeId", $EpsNodeId,
  "-ScenarioSet", $ScenarioSet,
  "-OutputDir", $reportsRoot
)

if ($SkipPdf) {
  $runnerArgs += "-SkipPdf"
}

& powershell @runnerArgs
if ($LASTEXITCODE -ne 0) {
  Write-Warning "k6 runner returned exit code $LASTEXITCODE. Analysis will still be generated if a manifest exists."
}

$latestRun = Get-ChildItem -LiteralPath $reportsRoot -Directory |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $latestRun) {
  throw "No run directory was created under $reportsRoot"
}

$manifestPath = Join-Path $latestRun.FullName "suite-manifest.json"
if (-not (Test-Path $manifestPath)) {
  throw "Suite manifest was not found: $manifestPath"
}

$analysisPath = Join-Path $latestRun.FullName "staging-performance-analysis.md"
$analyzer = Join-Path $scriptRoot "scripts\analyze-k6-run.cjs"
& node $analyzer --manifest $manifestPath --out $analysisPath
if ($LASTEXITCODE -ne 0) {
  throw "Analysis generation failed."
}

Write-Host ""
Write-Host "Staging performance run complete." -ForegroundColor Green
Write-Host "Run folder: $($latestRun.FullName)"
Write-Host "Analysis: $analysisPath"
Write-Host "k6 report: $(Join-Path $latestRun.FullName 'load-test-report.md')"
