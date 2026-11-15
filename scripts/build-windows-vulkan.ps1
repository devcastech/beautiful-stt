# build-windows-vulkan.ps1
# Builds whisper-cli with Vulkan from source using MSVC (static, single exe) and
# installs it as a Tauri sidecar:
#   src-tauri/binaries/whisper-cli-vulkan-x86_64-pc-windows-msvc.exe
#
# Windows equivalent of scripts/build-linux-vulkan.sh. whisper.cpp does not ship
# a prebuilt Vulkan zip for Windows, so we compile it ourselves.
#
# Usage:
#   .\scripts\build-windows-vulkan.ps1
#   .\scripts\build-windows-vulkan.ps1 -WhisperVersion v1.8.4
#   .\scripts\build-windows-vulkan.ps1 -Clean            # re-clone and rebuild from scratch
#
# Prerequisites (the script checks each one and tells you how to install it):
#   - Git                         winget install Git.Git
#   - CMake >= 3.21               winget install Kitware.CMake
#   - Visual Studio Build Tools   winget install Microsoft.VisualStudio.2022.BuildTools
#     with the "Desktop development with C++" workload
#   - Vulkan SDK                  winget install KhronosGroup.VulkanSDK
#     (provides glslc, headers and vulkan-1.lib; sets VULKAN_SDK env var)
#
# At runtime the produced exe only needs vulkan-1.dll, which every GPU driver
# with Vulkan support installs into System32. No extra DLLs to bundle.

param(
    [string]$WhisperVersion = "v1.8.5",
    [string]$VulkanSdk = "",      # default: $env:VULKAN_SDK or newest under C:\VulkanSDK
    [switch]$Clean,               # wipe cached source/build dirs first
    [int]$Jobs = 0                # parallel jobs (default: logical CPU count)
)

$ErrorActionPreference = "Stop"

# ── Paths ─────────────────────────────────────────────────────────────────────
$Root     = Split-Path $PSScriptRoot -Parent
$BinDir   = Join-Path $Root "src-tauri\binaries"
$OutName  = "whisper-cli-vulkan-x86_64-pc-windows-msvc.exe"
$Out      = Join-Path $BinDir $OutName
$SrcDir   = Join-Path $env:TEMP "whisper-vulkan-src-$WhisperVersion"
$BuildDir = Join-Path $env:TEMP "whisper-vulkan-build-$WhisperVersion"
$RepoUrl  = "https://github.com/ggml-org/whisper.cpp"

if ($Jobs -le 0) { $Jobs = [Environment]::ProcessorCount }

# ── Helpers ───────────────────────────────────────────────────────────────────
function Log([string]$msg)  { Write-Host "[vulkan-build] $msg" -ForegroundColor Cyan }
function Warn([string]$msg) { Write-Host "[vulkan-build] WARNING: $msg" -ForegroundColor Yellow }
function Die([string]$msg)  { Write-Host "[vulkan-build] ERROR: $msg" -ForegroundColor Red; exit 1 }

function Find-VulkanSdk {
    if ($VulkanSdk) { return $VulkanSdk }
    if ($env:VULKAN_SDK -and (Test-Path $env:VULKAN_SDK)) { return $env:VULKAN_SDK }
    $candidates = Get-ChildItem "C:\VulkanSDK" -Directory -ErrorAction SilentlyContinue |
        Sort-Object { try { [version]$_.Name } catch { [version]"0.0" } } -Descending
    if ($candidates) { return $candidates[0].FullName }
    return $null
}

# Imports the MSVC x64 environment (cl, link, dumpbin, INCLUDE, LIB...) into this process.
function Import-MsvcEnv {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
    if (-not (Test-Path $vswhere)) {
        Die "vswhere.exe not found. Install Visual Studio Build Tools with the C++ workload:`n  winget install Microsoft.VisualStudio.2022.BuildTools --override `"--wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended`""
    }
    $vsPath = & $vswhere -latest -products * `
        -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
        -property installationPath
    if (-not $vsPath) {
        Die "No Visual Studio installation with the MSVC x64 toolset (Desktop development with C++) was found."
    }
    $vcvars = Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat"
    if (-not (Test-Path $vcvars)) { Die "vcvars64.bat not found under $vsPath" }

    Log "MSVC: $vsPath"
    $envDump = cmd.exe /s /c "`"$vcvars`" >nul 2>&1 && set"
    if ($LASTEXITCODE -ne 0) { Die "vcvars64.bat failed (exit code $LASTEXITCODE)" }
    foreach ($line in $envDump) {
        $idx = $line.IndexOf('=')
        if ($idx -gt 0) {
            $name  = $line.Substring(0, $idx)
            $value = $line.Substring($idx + 1)
            Set-Item -Path "Env:$name" -Value $value
        }
    }
    if (-not (Get-Command cl.exe -ErrorAction SilentlyContinue)) { Die "cl.exe still not on PATH after vcvars64.bat" }
}

# ── 1. Prerequisites ──────────────────────────────────────────────────────────
if (-not (Get-Command git -ErrorAction SilentlyContinue))   { Die "git not found.   winget install Git.Git" }
if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) { Die "cmake not found. winget install Kitware.CMake" }

$sdk = Find-VulkanSdk
if (-not $sdk) {
    Die "Vulkan SDK not found. Install it and re-open the terminal:`n  winget install KhronosGroup.VulkanSDK`n  (or https://vulkan.lunarg.com/sdk/home#windows), or pass -VulkanSdk <path>"
}
$glslc = Join-Path $sdk "Bin\glslc.exe"
if (-not (Test-Path $glslc)) { Die "glslc.exe not found at $glslc (incomplete Vulkan SDK?)" }
$env:VULKAN_SDK = $sdk
$env:PATH = (Join-Path $sdk "Bin") + ";" + $env:PATH
Log "Vulkan SDK: $sdk"

Import-MsvcEnv

$generatorArgs = @()
if (Get-Command ninja -ErrorAction SilentlyContinue) {
    $generatorArgs = @("-G", "Ninja")
    Log "generator: Ninja"
} else {
    Log "generator: CMake default (Visual Studio)"
}

# ── 2. Source ─────────────────────────────────────────────────────────────────
if ($Clean) {
    Log "cleaning cached dirs"
    foreach ($d in @($SrcDir, $BuildDir)) { if (Test-Path $d) { Remove-Item $d -Recurse -Force } }
}

# Through cmd.exe: redirecting a native command's stderr in PowerShell 5.1 turns
# it into a terminating error under $ErrorActionPreference=Stop.
$srcTag = ""
if (Test-Path (Join-Path $SrcDir "CMakeLists.txt")) {
    $srcTag = (cmd.exe /s /c "git -C `"$SrcDir`" describe --tags --exact-match 2>nul") -join ""
    if ($LASTEXITCODE -ne 0) { $srcTag = "" }
}
if ($srcTag.Trim() -eq $WhisperVersion) {
    Log "reusing source: $SrcDir"
} else {
    if (Test-Path $SrcDir) { Remove-Item $SrcDir -Recurse -Force }
    Log "cloning whisper.cpp $WhisperVersion"
    git clone --quiet --depth 1 --branch $WhisperVersion $RepoUrl $SrcDir
    if ($LASTEXITCODE -ne 0) { Die "git clone failed (exit code $LASTEXITCODE)" }
}

# whisper-cli calls ggml_backend_load_all(), which scans the exe's own directory
# for ggml-*.dll and dlopens whatever it finds. In the app bundle this exe sits
# next to the CPU build's ggml-cpu.dll / ggml-blas.dll, which then crash with
# "GGML_ASSERT(prev != ggml_uncaught_exception)". A static build already has its
# backends compiled in, so the call is unnecessary: drop it.
$cliRel = "examples/cli/cli.cpp"
$cliCpp = Join-Path $SrcDir $cliRel
# Always start from the pristine upstream file so re-runs do not patch twice.
git -C $SrcDir checkout --quiet -- $cliRel
$cliSrc = [System.IO.File]::ReadAllText($cliCpp)
if ($cliSrc -match 'ggml_backend_load_all\(\);') {
    Log "patching cli.cpp: removing ggml_backend_load_all()"
    $cliSrc = $cliSrc -replace 'ggml_backend_load_all\(\);', '/* backend auto-loading removed by build-windows-vulkan.ps1 */'
    [System.IO.File]::WriteAllText($cliCpp, $cliSrc, [System.Text.UTF8Encoding]::new($false))
} else {
    Warn "ggml_backend_load_all() not found in $cliRel; the exe may still load sibling ggml-*.dll files"
}

# ── 3. Configure + build ──────────────────────────────────────────────────────
Log "building whisper.cpp $WhisperVersion with Vulkan, $Jobs jobs (several minutes)"

# Mirrors build-linux-vulkan.sh: static, no -march=native, no tests.
# CMP0091 + MultiThreaded links the MSVC CRT statically so the exe does not
# depend on vcruntime140.dll / msvcp140.dll being installed on the user's PC.
# GGML_OPENMP=OFF avoids VCOMP140.DLL (OpenMP runtime, not part of Windows);
# ggml falls back to its own thread pool for the few ops that run on CPU.
cmake -S $SrcDir -B $BuildDir @generatorArgs `
    -DCMAKE_BUILD_TYPE=Release `
    -DCMAKE_POLICY_DEFAULT_CMP0091=NEW `
    -DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded `
    -DGGML_VULKAN=ON `
    -DGGML_OPENMP=OFF `
    -DGGML_NATIVE=OFF `
    -DBUILD_SHARED_LIBS=OFF `
    -DWHISPER_BUILD_TESTS=OFF `
    -DWHISPER_BUILD_EXAMPLES=ON
if ($LASTEXITCODE -ne 0) { Die "cmake configure failed (exit code $LASTEXITCODE)" }

cmake --build $BuildDir --config Release --target whisper-cli -j $Jobs
if ($LASTEXITCODE -ne 0) { Die "cmake build failed (exit code $LASTEXITCODE)" }

# Ninja puts it in bin\, the Visual Studio generator in bin\Release\
$built = @(
    (Join-Path $BuildDir "bin\whisper-cli.exe"),
    (Join-Path $BuildDir "bin\Release\whisper-cli.exe")
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $built) { Die "whisper-cli.exe not produced under $BuildDir\bin" }

# ── 4. Install sidecar ────────────────────────────────────────────────────────
New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
Copy-Item $built $Out -Force
if (-not (Test-Path $Out)) { Die "binary not produced: $Out" }

# ── 5. Verify (equivalent of the glibc check on Linux) ───────────────────────
# A static build must depend only on OS DLLs plus vulkan-1.dll (from the GPU driver).
$deps = @()
if (Get-Command dumpbin.exe -ErrorAction SilentlyContinue) {
    $deps = (dumpbin /nologo /dependents $Out) |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -match '^[\w\-\.]+\.dll$' }
    $bad = $deps | Where-Object { $_ -match '^(ggml|whisper|vcruntime|msvcp|vcomp)' }
    if ($bad) { Die "binary is not self-contained, it depends on: $($bad -join ', ')" }
    if (-not ($deps -contains 'vulkan-1.dll')) { Warn "vulkan-1.dll is not among the imports; was GGML_VULKAN really enabled?" }
} else {
    Warn "dumpbin.exe not available, skipping dependency check"
}

# Run through cmd.exe: in Windows PowerShell 5.1 a native command's stderr under
# 2>&1 becomes ErrorRecords, which $ErrorActionPreference=Stop turns fatal.
# (GPU enumeration happens lazily at model load, so --help says nothing about Vulkan.)
$smoke = cmd.exe /s /c "`"$Out`" --help 2>&1"
if (-not ($smoke -match 'usage')) { Warn "'$OutName --help' did not print usage; the exe may not run on this machine" }

Log "ok: $Out"
Log "size: $([math]::Round((Get-Item $Out).Length / 1MB, 1)) MB"
if ($deps) { Log "dynamic deps: $($deps -join ' ')" }
