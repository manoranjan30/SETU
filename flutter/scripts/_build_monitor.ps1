# _build_monitor.ps1
# Animated in-place progress bar for Flutter release builds.
# Reads flutter build stdout+stderr from stdin; draws a live bar.
# Errors are printed immediately (not just in the end summary).
#
# Usage (called by build scripts):
#   flutter build apk ... 2>&1 | powershell -NoProfile -ExecutionPolicy Bypass -File "_build_monitor.ps1"

# ── Stage map ─────────────────────────────────────────────────────────────────
$stages = @(
    [PSCustomObject]@{ Pattern = 'Running|pub.get|Launching|Resolving';                        Pct =  4; Label = 'Initializing'          }
    [PSCustomObject]@{ Pattern = 'Compiling|compiling|kernel|snapshot|dart2js';               Pct = 14; Label = 'Compiling Dart'         }
    [PSCustomObject]@{ Pattern = 'Running Gradle|Executing tasks|Gradle task|assembleRelease'; Pct = 24; Label = 'Starting Gradle'        }
    [PSCustomObject]@{ Pattern = 'processReleaseManifest|mergeReleaseRes|generateRelease';     Pct = 38; Label = 'Processing resources'   }
    [PSCustomObject]@{ Pattern = 'checkRelease|validateSigning|mergeReleaseJava';              Pct = 50; Label = 'Merging & validating'   }
    [PSCustomObject]@{ Pattern = 'lintRelease|lintVital';                                      Pct = 58; Label = 'Lint checks'            }
    [PSCustomObject]@{ Pattern = 'dexRelease|dexingWith|Dexing';                               Pct = 70; Label = 'Dexing (slow step)'     }
    [PSCustomObject]@{ Pattern = 'stripRelease|shrinkRelease|minifyRelease';                   Pct = 82; Label = 'Shrinking & stripping'  }
    [PSCustomObject]@{ Pattern = 'packageRelease';                                             Pct = 88; Label = 'Packaging APK'          }
    [PSCustomObject]@{ Pattern = 'assembleRelease|BUILD SUCCESSFUL';                           Pct = 95; Label = 'Assembling release'     }
    [PSCustomObject]@{ Pattern = 'Built |Gradle build done';                                   Pct =100; Label = 'Build complete!'        }
)

$BAR_W  = 26
$start  = Get-Date
$script:pct      = 0
$script:label    = 'Starting...'
$script:barRow   = 0
$script:errorRow = 0      # row where live errors are printed (below bar area)
$buildErrors = [System.Collections.Generic.List[string]]::new()

# ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime([int]$sec) {
    if ($sec -lt 0) { $sec = 0 }
    $m = [int][Math]::Floor($sec / 60); $s = $sec - $m * 60
    '{0:D2}:{1:D2}' -f $m, $s
}

function safeRow([int]$row) {
    $max = [Math]::Max([Console]::BufferHeight - 1, 0)
    [Math]::Min($row, $max)
}

function drawBar([int]$Pct, [string]$Label, [int]$Elapsed, [int]$Eta) {
    $cw    = [Math]::Max([Console]::WindowWidth - 1, 79)
    $fill  = [int](($Pct / 100.0) * $BAR_W)
    $empty = $BAR_W - $fill
    $bar   = ('#' * $fill) + ('-' * $empty)

    $pctStr = '{0,3}%' -f $Pct
    $eStr   = fmtTime $Elapsed

    if     ($Pct -ge 100) { $etaStr = '            ' }
    elseif ($Eta -gt 0)   { $etaStr = '~' + (fmtTime $Eta) + ' left' }
    else                   { $etaStr = 'calculating.' }

    $lbl  = $Label.PadRight(22).Substring(0, 22)
    $line = "  [$bar] $pctStr  $lbl  $eStr  $etaStr"
    if ($line.Length -gt $cw) { $line = $line.Substring(0, $cw) }

    [Console]::SetCursorPosition(0, (safeRow $script:barRow))
    [Console]::Write($line.PadRight($cw))
}

function drawActivity([string]$text) {
    $cw  = [Math]::Max([Console]::WindowWidth - 1, 79)
    $act = '  > ' + $text
    if ($act.Length -gt $cw) { $act = $act.Substring(0, $cw - 3) + '...' }
    [Console]::SetCursorPosition(0, (safeRow ($script:barRow + 1)))
    [Console]::Write($act.PadRight($cw))
}

# Print an error immediately below the reserved bar area (rows barRow, barRow+1, barRow+2)
# so errors are never swallowed.
function printError([string]$msg) {
    $cw = [Math]::Max([Console]::WindowWidth - 1, 79)
    # Move cursor below the separator row (barRow + 3) and print
    $targetRow = safeRow ($script:barRow + 3 + $buildErrors.Count)
    # Expand buffer if needed
    $needed = $targetRow + 5
    if ([Console]::BufferHeight -lt $needed) {
        try { [Console]::BufferHeight = $needed + 10 } catch {}
    }
    $saved = [Console]::CursorTop
    [Console]::SetCursorPosition(0, $targetRow)
    $prefix = '  [ERROR] '
    $out = $prefix + $msg
    if ($out.Length -gt $cw) { $out = $out.Substring(0, $cw - 3) + '...' }
    [Console]::ForegroundColor = [ConsoleColor]::Red
    [Console]::Write($out.PadRight($cw))
    [Console]::ResetColor()
    # Restore cursor to avoid layout shifts mid-stream
    $restore = [Math]::Min($saved, [Console]::BufferHeight - 1)
    [Console]::SetCursorPosition(0, $restore)
}

# ── Main ──────────────────────────────────────────────────────────────────────
[Console]::CursorVisible = $false

$neededBuf = [Console]::CursorTop + 10
if ([Console]::BufferHeight -lt $neededBuf) {
    try { [Console]::BufferHeight = $neededBuf + 20 } catch {}
}

try {
    $cw = [Math]::Max([Console]::WindowWidth - 1, 79)
    [Console]::Write(('  ' + ('-' * ($cw - 2))).PadRight($cw))
    [Console]::WriteLine()

    $script:barRow = [Console]::CursorTop
    [Console]::WriteLine()   # row barRow   = progress bar
    [Console]::WriteLine()   # row barRow+1 = current activity
    [Console]::WriteLine()   # row barRow+2 = blank buffer

    # Closing separator row (barRow+3) — pre-print so it exists in the buffer
    [Console]::Write(('  ' + ('-' * ($cw - 2))).PadRight($cw))
    [Console]::WriteLine()

    $neededBuf2 = $script:barRow + 10
    if ([Console]::BufferHeight -lt $neededBuf2) {
        try { [Console]::BufferHeight = $neededBuf2 + 20 } catch {}
    }

    drawBar 0 $script:label 0 0

    foreach ($rawLine in $Input) {
        $trimmed = $rawLine.Trim()
        $elapsed = [int]((Get-Date) - $start).TotalSeconds

        # Stage detection
        foreach ($stage in $stages) {
            if ($stage.Pct -gt $script:pct -and $trimmed -match $stage.Pattern) {
                $script:pct   = $stage.Pct
                $script:label = $stage.Label
                break
            }
        }

        # Slow time-crawl
        $nextPct = ($stages | Where-Object { $_.Pct -gt $script:pct } |
                    Select-Object -First 1 -ExpandProperty Pct)
        if (-not $nextPct) { $nextPct = 95 }
        $crawlCap = [Math]::Min($nextPct - 3, 95)
        $crawled  = [int]($elapsed * 0.25)
        if ($crawled -gt $script:pct -and $crawled -lt $crawlCap) {
            $script:pct = $crawled
        }

        # ETA
        $eta = 0
        if ($script:pct -gt 5 -and $elapsed -gt 3) {
            $rate = [double]$elapsed / [double]$script:pct
            $eta  = [int]($rate * (100 - $script:pct))
        }

        # Capture + immediately display errors
        if ($trimmed -match '(^error:|^Error:|cannot find symbol|FAIL(ED|URE)|Exception|Cannot access|does not exist|What went wrong|Execution failed|symbol:\s+class)' -and
            $trimmed -notmatch '(Gradle [0-9]\.|file://|\.java:\d+: note|^\s*at |^> Run |^> Check |^> Get more|^> See the)') {
            if (-not $buildErrors.Contains($trimmed)) {
                $buildErrors.Add($trimmed)
                printError $trimmed
            }
        }

        # Redraw bar + activity
        drawBar  $script:pct $script:label $elapsed $eta
        drawActivity $trimmed
    }

    # Final bar
    $total = [int]((Get-Date) - $start).TotalSeconds
    drawBar ([Math]::Min($script:pct, 100)) $script:label $total 0
    drawActivity ''

    # Clear activity row
    $cw = [Math]::Max([Console]::WindowWidth - 1, 79)
    [Console]::SetCursorPosition(0, (safeRow ($script:barRow + 1)))
    [Console]::Write((' ' * $cw))

    # Move cursor below error rows (if any)
    $belowRow = $script:barRow + 4 + [Math]::Max($buildErrors.Count, 0)
    $belowRow = safeRow $belowRow
    [Console]::SetCursorPosition(0, $belowRow)

} finally {
    [Console]::CursorVisible = $true
}

# ── Summary ───────────────────────────────────────────────────────────────────
$total = [int]((Get-Date) - $start).TotalSeconds
Write-Host ''
Write-Host ("  Build time: $(fmtTime $total)") -ForegroundColor White

if ($buildErrors.Count -gt 0) {
    Write-Host ''
    Write-Host "  $($buildErrors.Count) error(s) -- full list:" -ForegroundColor Red
    $i = 1
    foreach ($be in $buildErrors) {
        Write-Host "  $i. $be" -ForegroundColor Red
        $i++
    }
    Write-Host ''
    Write-Host '  Tip: Run with --verbose for the full Gradle stack trace.' -ForegroundColor Yellow
} else {
    Write-Host '  No errors detected.' -ForegroundColor Green
}
Write-Host ''
