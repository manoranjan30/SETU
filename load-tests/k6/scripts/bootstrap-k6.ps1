param(
  [string]$Version = "0.49.0"
)

$ErrorActionPreference = "Stop"

$toolsRoot = Join-Path $PSScriptRoot "..\tools\k6"
$currentDir = Join-Path $toolsRoot "current"
$zipPath = Join-Path $toolsRoot ("k6-v" + $Version + "-windows-amd64.zip")
$extractDir = Join-Path $toolsRoot ("k6-v" + $Version + "-windows-amd64")
$downloadUrl = "https://github.com/grafana/k6/releases/download/v$Version/k6-v$Version-windows-amd64.zip"

New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null

$existing = Get-Command "k6" -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host ("k6 already available in PATH: " + $existing.Source)
  exit 0
}

$currentExe = Join-Path $currentDir "k6.exe"
if (Test-Path $currentExe) {
  Write-Host ("Using existing local k6: " + $currentExe)
  exit 0
}

Write-Host ("Downloading k6 v" + $Version + " from:")
Write-Host ("  " + $downloadUrl)
Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath

if (Test-Path $extractDir) {
  Remove-Item -Recurse -Force $extractDir
}

Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

$downloadedExe = Get-ChildItem -Path $extractDir -Recurse -Filter "k6.exe" | Select-Object -First 1
if (-not $downloadedExe) {
  throw "Downloaded archive did not contain k6.exe"
}

if (Test-Path $currentDir) {
  Remove-Item -Recurse -Force $currentDir
}
New-Item -ItemType Directory -Path $currentDir -Force | Out-Null
Copy-Item $downloadedExe.FullName (Join-Path $currentDir "k6.exe") -Force

Write-Host ("Local k6 ready at: " + (Join-Path $currentDir "k6.exe"))
