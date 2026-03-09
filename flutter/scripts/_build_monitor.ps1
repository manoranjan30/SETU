# _build_monitor.ps1
# Animated in-place progress bar for Flutter release builds.
# Reads flutter build stdout+stderr from stdin; draws a live bar.
#
# Usage (called by build scripts):
#   flutter build apk ... 2>&1 | powershell -NoProfile -ExecutionPolicy Bypass -File "_build_monitor.ps1"

# ── Stage map ─────────────────────────────────────────────────────────────────
# Each stage has a keyword pattern (regex), the % we jump to when detected,
# and a short label shown in the progress bar.
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

$BAR_W  = 26      # number of fill chars inside [ ]
$start  = Get-Date
$script:pct   = 0
$script:label = 'Starting...'
$script:barRow = 0
$errors = [System.Collections.Generic.List[string]]::new()

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

# ── Main ──────────────────────────────────────────────────────────────────────
[Console]::CursorVisible = $false

# Ensure the console buffer is tall enough for our 4 reserved rows.
# In some CMD sessions the buffer can be as small as 30 lines.
$neededBuf = [Console]::CursorTop + 10
if ([Console]::BufferHeight -lt $neededBuf) {
    try { [Console]::BufferHeight = $neededBuf + 20 } catch {}
}

try {
    # Print separator line, then anchor barRow AFTER it so the bar
    # always lands on a freshly scrolled-into-view row.
    $cw = [Math]::Max([Console]::WindowWidth - 1, 79)
    [Console]::Write(('  ' + ('-' * ($cw - 2))).PadRight($cw))
    [Console]::WriteLine()

    $script:barRow = [Console]::CursorTop
    [Console]::WriteLine()   # row barRow   = progress bar (overwritten each tick)
    [Console]::WriteLine()   # row barRow+1 = current activity line
    [Console]::WriteLine()   # row barRow+2 = blank buffer row

    # Expand buffer again now that we've scrolled, if needed
    $neededBuf2 = $script:barRow + 6
    if ([Console]::BufferHeight -lt $neededBuf2) {
        try { [Console]::BufferHeight = $neededBuf2 + 10 } catch {}
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

        # Slow time-crawl: advance 0.25% per second, but stop 3% before the
        # next stage boundary so stage jumps still feel snappy.
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
            $rate = [double]$elapsed / [double]$script:pct   # seconds per 1%
            $eta  = [int]($rate * (100 - $script:pct))
        }

        # Capture errors (exclude noisy Gradle version warnings)
        if ($trimmed -match '(^error:|^Error:|FAILED|Exception)' -and
            $trimmed -notmatch '(Gradle [0-9]|file://|\.java:\d|^\s*at )') {
            $errors.Add($trimmed)
        }

        # Redraw
        drawBar  $script:pct $script:label $elapsed $eta
        drawActivity $trimmed
    }

    # Final bar at 100%
    $total = [int]((Get-Date) - $start).TotalSeconds
    drawBar ([Math]::Min($script:pct, 100)) $script:label $total 0
    drawActivity ''

    # Clear activity row, draw closing separator, move cursor below
    $cw = [Math]::Max([Console]::WindowWidth - 1, 79)
    [Console]::SetCursorPosition(0, (safeRow ($script:barRow + 1)))
    [Console]::Write((' ' * $cw))
    [Console]::SetCursorPosition(0, (safeRow ($script:barRow + 2)))
    [Console]::Write(('  ' + ('-' * ($cw - 2))).PadRight($cw))
    [Console]::SetCursorPosition(0, (safeRow ($script:barRow + 3)))

} finally {
    [Console]::CursorVisible = $true
}

# ── Summary ───────────────────────────────────────────────────────────────────
$total = [int]((Get-Date) - $start).TotalSeconds
Write-Host ''
Write-Host ("  Build time: $(fmtTime $total)") -ForegroundColor White

if ($errors.Count -gt 0) {
    Write-Host ''
    Write-Host "  $($errors.Count) error(s) found:" -ForegroundColor Red
    foreach ($e in $errors) {
        Write-Host "    $e" -ForegroundColor Red
    }
}
Write-Host ''
