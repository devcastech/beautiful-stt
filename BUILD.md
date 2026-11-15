# Build

Dev notes. User docs are in [README.md](README.md).

## Prerequisites

All platforms: Rust stable, Node LTS, `pnpm` 11, [Tauri 2 deps](https://tauri.app/start/prerequisites/).

**Windows**
```powershell
winget install Microsoft.VisualStudio.2022.BuildTools   # with "Desktop development with C++"
winget install Kitware.CMake                             # 4.1+ required with VS 2026
winget install LLVM.LLVM                                 # libclang for bindgen (llama-cpp-sys-2)
```
If `.ps1` scripts are blocked: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

**Linux (Debian/Ubuntu)**
```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf xdg-utils
```

**macOS**: Xcode CLI tools, `brew install whisper-cpp` (used in dev).

## Dev

```bash
pnpm install
pnpm tauri dev
```

Sidecars from `src-tauri/binaries/` are copied to `target/debug/`, so GPU works in dev too.
The terminal shows `[STT] ... used_gpu=true|false`.

## Release build

**macOS**
```bash
set -gx CXXFLAGS "-mmacosx-version-min=11.0 -std=c++17"
set -gx CFLAGS "-mmacosx-version-min=11.0"
set -gx MACOSX_DEPLOYMENT_TARGET 11.0
set -gx CMAKE_OSX_DEPLOYMENT_TARGET 11.0
CMAKE_GENERATOR="Unix Makefiles" CMAKE_POLICY_VERSION_MINIMUM=3.5 pnpm tauri build
```

**Linux**
```bash
APPIMAGE_EXTRACT_AND_RUN=1 pnpm tauri build
```

**Windows, default** (CPU/BLAS `whisper-cli` + Vulkan sidecar)
```powershell
pnpm tauri build
```

**Windows, CUDA** (swaps in the prebuilt CUDA 12.4 `whisper-cli`, restores originals after; no Vulkan sidecar)
```powershell
.\scripts\build-windows-cuda.ps1                                      # downloads ~460 MB zip
.\scripts\build-windows-cuda.ps1 -SkipDownload                        # reuse zip
.\scripts\build-windows-cuda.ps1 -WhisperVersion v1.8.4 -SkipDownload
```

Releases: pushing a `v*` tag runs `.github/workflows/release.yml` (macOS, Ubuntu, Windows) and publishes a draft release. CI uses the committed sidecars as-is.

## Sidecars

All in `src-tauri/binaries/`, committed, named `<name>-<target-triple>[.exe]`.
Declared in `tauri.conf.json` `externalBin`; `tauri.linux.conf.json` / `tauri.windows.conf.json` override the full list.

| Sidecar | Platforms | Where it comes from |
|---|---|---|
| `whisper-cli` | all | whisper.cpp release zip (Windows BLAS, needs `whisper.dll ggml*.dll libopenblas.dll` as resources), Homebrew (macOS), static build (Linux) |
| `whisper-cli-vulkan` | Windows, Linux | scripts below, static, only `vulkan-1.dll` from the driver at runtime |
| `yt-dlp` | all | yt-dlp releases |

Rebuild the Vulkan sidecar only when bumping whisper.cpp:

```bash
# Linux: builds inside ubuntu:24.04 (docker/podman) so glibc matches the app
scripts/build-linux-vulkan.sh
WHISPER_VERSION=v1.8.4 DOCKER="sudo docker" scripts/build-linux-vulkan.sh
```

```powershell
# Windows: needs the Vulkan SDK (winget install KhronosGroup.VulkanSDK, then a new terminal)
.\scripts\build-windows-vulkan.ps1
.\scripts\build-windows-vulkan.ps1 -WhisperVersion v1.8.4 -Clean
```

The Windows script also removes `ggml_backend_load_all()` from `whisper-cli` (otherwise it loads the CPU build's `ggml-*.dll` next to it and crashes) and links OpenMP/CRT statically.

## GPU at runtime (Windows/Linux)

- The app runs `whisper-cli-vulkan` first; if it fails or reports no device it falls back to `whisper-cli` (CPU) for the rest of the session.
- `BSTT_DISABLE_GPU=1` forces CPU.
- **Integrated AMD GPU on Windows**: the driver exposes only the BIOS-reserved VRAM (usually 512 MB) as GPU memory, so `large-v3-turbo` (1.6 GB) runs mostly from system RAM and is barely faster than CPU. Same machine on Linux (RADV) is ~3x faster. Use a q8_0 model, or raise "UMA Frame Buffer Size" in the BIOS if available.
- Diagnose with `vulkaninfo` (memory heaps) and the `whisper_print_timings` block of `whisper-cli`.
