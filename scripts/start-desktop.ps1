# One-click T3 Code desktop launcher: rebuild when the checkout moved ahead of
# the bundle, then start.
# Shortcut equivalent: powershell -NoProfile -ExecutionPolicy Bypass -File <this file>
# Flags: -Rebuild forces a fresh `pnpm build:desktop` even when up to date;
# -Attached keeps the app tied to this console (default launches it detached
# so closing the window is safe).
param(
    [switch]$Rebuild,
    [switch]$Attached
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$bundle = Join-Path $repoRoot "apps\desktop\dist-electron\main.cjs"
$markerPath = Join-Path $repoRoot "apps\desktop\dist-electron\.build-commit"
$commit = (git -C $repoRoot rev-parse HEAD).Trim()
$builtCommit = if (Test-Path $markerPath) { (Get-Content $markerPath -Raw).Trim() } else { $null }

# Uncommitted edits are invisible to HEAD; use -Rebuild after editing source
# without committing.
if ($Rebuild -or -not (Test-Path $bundle) -or $builtCommit -ne $commit) {
    Write-Host "Building desktop bundle for $($commit.Substring(0, 7))..." -ForegroundColor Cyan
    pnpm build:desktop
    if ($LASTEXITCODE -ne 0) {
        throw "pnpm build:desktop failed (if dependencies are missing, run 'pnpm install' once)"
    }
    Set-Content -Path $markerPath -Value $commit
}

if (-not (Test-Path $bundle)) {
    throw "Desktop bundle still missing at $bundle"
}

if ($Attached) {
    pnpm start:desktop
} else {
    $pnpmCmd = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue
    if (-not $pnpmCmd) { $pnpmCmd = Get-Command "pnpm" }
    Start-Process -FilePath $pnpmCmd.Source -ArgumentList "start:desktop" `
        -WorkingDirectory $repoRoot -WindowStyle Hidden
}
