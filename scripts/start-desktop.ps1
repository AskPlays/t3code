# One-click T3 Code desktop launcher: build if the bundle is missing, then start.
# Shortcut equivalent: powershell -NoProfile -ExecutionPolicy Bypass -File <this file>
# Flags: -Rebuild forces a fresh `pnpm build:desktop`; -Attached keeps the app
# tied to this console (default launches it detached so closing the window is safe).
param(
    [switch]$Rebuild,
    [switch]$Attached
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$bundle = Join-Path $repoRoot "apps\desktop\dist-electron\main.cjs"
if ($Rebuild -or -not (Test-Path $bundle)) {
    if (-not (Test-Path (Join-Path $repoRoot "node_modules"))) {
        pnpm install
        if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }
    }
    Write-Host "Building desktop bundle..." -ForegroundColor Cyan
    pnpm build:desktop
    if ($LASTEXITCODE -ne 0) { throw "pnpm build:desktop failed" }
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
