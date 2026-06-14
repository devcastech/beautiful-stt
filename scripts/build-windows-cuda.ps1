# build-windows-cuda.ps1
# Downloads whisper.cpp CUDA 12.4 binaries, places them in src-tauri/binaries/,
# temporarily updates tauri.windows.conf.json, and runs `pnpm tauri build`.
# Originals are always restored on exit (success or failure).

param(
    [string]$WhisperVersion = "v1.8.5",
    [switch]$SkipDownload   # Reuse cached zip from TEMP if available
)

$ErrorActionPreference = "Stop"

# ── Paths ─────────────────────────────────────────────────────────────────────
$Root        = Split-Path $PSScriptRoot -Parent
$BinDir      = Join-Path $Root "src-tauri\binaries"
$WinConf     = Join-Path $Root "src-tauri\tauri.windows.conf.json"
$ZipUrl      = "https://github.com/ggml-org/whisper.cpp/releases/download/$WhisperVersion/whisper-cublas-12.4.0-bin-x64.zip"
$ZipPath     = Join-Path $env:TEMP "whisper-cublas-12.4.0-bin-x64-$WhisperVersion.zip"
$ExtractBase = Join-Path $env:TEMP "whisper-cublas-preview-$WhisperVersion"
$ExtractDir  = Join-Path $ExtractBase "Release"

# DLLs from the CUDA package that Tauri must bundle with the installer
$CudaDlls = @(
    "whisper.dll",
    "ggml.dll",
    "ggml-base.dll",
    "ggml-cpu.dll",
    "ggml-cuda.dll",
    "cublas64_12.dll",
    "cudart64_12.dll"
)

# ── Helpers ───────────────────────────────────────────────────────────────────
function Log([string]$msg) { Write-Host "[cuda-build] $msg" -ForegroundColor Cyan }
function Die([string]$msg) { Write-Host "[cuda-build] ERROR: $msg" -ForegroundColor Red; exit 1 }

# ── 1. Download zip ───────────────────────────────────────────────────────────
if ($SkipDownload -and (Test-Path $ZipPath)) {
    Log "Reusing cached zip: $ZipPath"
} else {
    Log "Downloading whisper.cpp $WhisperVersion with CUDA 12.4 (~460 MB)..."
    Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipPath -UseBasicParsing
    Log "Download complete: $([math]::Round((Get-Item $ZipPath).Length/1MB,1)) MB"
}

# ── 2. Extract ────────────────────────────────────────────────────────────────
Log "Extracting zip..."
if (Test-Path $ExtractBase) { Remove-Item $ExtractBase -Recurse -Force }
Expand-Archive -Path $ZipPath -DestinationPath $ExtractBase -Force

# ── 3. Backup originals ───────────────────────────────────────────────────────
$BackupDir = Join-Path $env:TEMP "beautiful-stt-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $BackupDir | Out-Null
Log "Backing up binaries/ and tauri.windows.conf.json to $BackupDir"

Copy-Item $WinConf (Join-Path $BackupDir "tauri.windows.conf.json")
Get-ChildItem $BinDir -Filter "*.dll" | ForEach-Object { Copy-Item $_.FullName $BackupDir }
Copy-Item (Join-Path $BinDir "whisper-cli-x86_64-pc-windows-msvc.exe") $BackupDir -ErrorAction SilentlyContinue

# ── Restore function (called in finally) ──────────────────────────────────────
function Restore-Originals {
    Log "Restoring original files from backup..."

    # Remove CUDA DLLs
    Get-ChildItem $BinDir -Filter "*.dll" | Remove-Item -Force

    # Restore everything from backup
    Get-ChildItem $BackupDir | ForEach-Object { Copy-Item $_.FullName $BinDir -Force }

    # Restore original whisper-cli exe (may not exist if there was none before)
    $origExe = Join-Path $BackupDir "whisper-cli-x86_64-pc-windows-msvc.exe"
    if (Test-Path $origExe) {
        Copy-Item $origExe (Join-Path $BinDir "whisper-cli-x86_64-pc-windows-msvc.exe") -Force
    }

    # Restore tauri.windows.conf.json
    Copy-Item (Join-Path $BackupDir "tauri.windows.conf.json") $WinConf -Force

    Log "Restore complete."
}

try {
    # ── 4. Copy whisper-cli.exe ───────────────────────────────────────────────
    $srcExe = Join-Path $ExtractDir "whisper-cli.exe"
    $dstExe = Join-Path $BinDir "whisper-cli-x86_64-pc-windows-msvc.exe"
    if (-not (Test-Path $srcExe)) { Die "whisper-cli.exe not found in zip" }
    Log "Copying whisper-cli.exe -> $dstExe"
    Copy-Item $srcExe $dstExe -Force

    # ── 5. Remove existing CPU/BLAS DLLs ─────────────────────────────────────
    Log "Removing old CPU/BLAS DLLs..."
    Get-ChildItem $BinDir -Filter "*.dll" | Remove-Item -Force

    # ── 6. Copy CUDA DLLs ────────────────────────────────────────────────────
    Log "Copying CUDA DLLs..."
    foreach ($dll in $CudaDlls) {
        $src = Join-Path $ExtractDir $dll
        if (Test-Path $src) {
            Log "  $dll ($([math]::Round((Get-Item $src).Length/1MB,1)) MB)"
            Copy-Item $src $BinDir -Force
        } else {
            Write-Host "[cuda-build] WARNING: $dll not found in zip, skipping." -ForegroundColor Yellow
        }
    }

    # ── 7. Update tauri.windows.conf.json ────────────────────────────────────
    Log "Updating tauri.windows.conf.json for CUDA..."
    $resources = [ordered]@{}
    foreach ($dll in $CudaDlls) {
        if (Test-Path (Join-Path $BinDir $dll)) {
            $resources["binaries/$dll"] = ""
        }
    }
    $conf = [ordered]@{ bundle = [ordered]@{ resources = $resources } }
    $json = $conf | ConvertTo-Json -Depth 5
    [System.IO.File]::WriteAllText($WinConf, $json, [System.Text.UTF8Encoding]::new($false))

    # ── 8. Build ──────────────────────────────────────────────────────────────
    Log "Running pnpm tauri build..."
    Set-Location $Root
    $pnpm = if (Get-Command pnpm -ErrorAction SilentlyContinue) { "pnpm" } else { "$env:LOCALAPPDATA\pnpm\bin\pnpm.ps1" }
    & $pnpm tauri build
    if ($LASTEXITCODE -ne 0) { Die "pnpm tauri build failed (exit code $LASTEXITCODE)" }

    Log "CUDA build completed successfully."

} finally {
    Restore-Originals
}
