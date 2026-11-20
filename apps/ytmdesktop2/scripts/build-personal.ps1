# Personal build: produce the Windows NSIS installer in apps/ytmdesktop2/dist.
#
#   powershell -ExecutionPolicy Bypass -File apps\ytmdesktop2\scripts\build-personal.ps1
#
# Why not `pnpm build:win`:
# - pnpm may not be on PATH (only via corepack), but electron-builder shells out to `pnpm`.
# - Run directly, electron-builder detects npm instead of pnpm (fixed via npm_config_user_agent).
# - With pnpm 11 + nodeLinker: hoisted, `pnpm list` run inside apps/ytmdesktop2 reports the
#   workspace root instead of this app, so electron-builder packs no node_modules and the
#   installed app dies with "Cannot find module ...". The shim below adds `--filter .`.
# - CI=1 keeps pnpm from blocking on interactive prompts (e.g. "reinstall node_modules?").
$ErrorActionPreference = "Stop"
$appDir = Split-Path $PSScriptRoot -Parent
$root = Resolve-Path (Join-Path $appDir "..\..")
$bin = Join-Path $root "node_modules\.bin"

$shimDir = Join-Path ([IO.Path]::GetTempPath()) "ytmd-personal-pnpm-shim"
New-Item -ItemType Directory -Force $shimDir | Out-Null
Set-Content -Encoding ascii (Join-Path $shimDir "pnpm.cmd") @'
@echo off
if /I "%~1"=="list" (
  corepack pnpm --filter . %*
) else (
  corepack pnpm %*
)
'@

$env:PATH = "$shimDir;$env:PATH"
$env:CI = "1"
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT = "0"
# electron-builder picks the package manager from the user agent; outside `pnpm exec` it would
# fall back to npm, whose `npm list` can't see pnpm's hoisted tree.
$env:npm_config_user_agent = "pnpm/11.15.1 npm/? node/$(node -v) win32 x64"

Push-Location $appDir
try {
	if (-not (Test-Path (Join-Path $root "node_modules\@paralleldrive\cuid2"))) {
		Write-Host "node_modules incomplete, running pnpm install..."
		Push-Location $root; corepack pnpm install --frozen-lockfile; Pop-Location
		if ($LASTEXITCODE) { throw "pnpm install failed" }
	}
	& (Join-Path $bin "electron-vite.cmd") build
	if ($LASTEXITCODE) { throw "electron-vite build failed" }
	& (Join-Path $bin "electron-builder.cmd") --win
	if ($LASTEXITCODE) { throw "electron-builder failed" }

	# Sanity check: the asar must contain the runtime dependencies.
	$asar = Join-Path $appDir "dist\win-unpacked\resources\app.asar"
	$entries = & (Join-Path $bin "asar.cmd") list $asar
	if (-not ($entries -match "\\node_modules\\@paralleldrive\\cuid2$")) {
		throw "app.asar is missing node_modules (dependency collection failed)"
	}
	Get-ChildItem (Join-Path $appDir "dist\*.exe") | ForEach-Object { Write-Host "Installer: $($_.FullName)" }
} finally {
	Pop-Location
}
