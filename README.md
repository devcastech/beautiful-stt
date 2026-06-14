# Beautiful Speech to Text

Local, private, and free speech-to-text transcription powered by OpenAI's Whisper model.

## Why?

Commercial transcription services (Google, AWS, Azure, etc.) require you to:
- Pay per minute of audio
- Upload your audio files to their servers

This is a problem when your audio contains:
- Confidential business information
- Government or legal information
- Medical records
- Personal conversations
- Sensitive client data

<div align="center">
  <video src="https://github.com/user-attachments/assets/82ef7f7e-1402-4f9c-980d-2223a0f40259" controls="controls" style="max-width: 100%; border-radius: 10px;">
    Your browser does not support the video tag.
  </video>
</div>

**Beautiful STT runs 100% locally.** Your audio never leaves your machine.

## Features

- Fully local processing, no internet required after model download
- Supports multiple audio formats (MP3, WAV, FLAC, OGG, AAC, M4A, MP4)
- Download audio directly from YouTube and Facebook URLs via `yt-dlp`
- AI-powered summarization via local LLM (`llama-completion`)
- Dark mode and accessibility support
- Automatic noise reduction
- GPU acceleration (Metal on macOS, CUDA on Windows/Linux)
- Uses from tiny to large-v3 Whisper models depending on available resources

## Bundled binaries

Beautiful STT ships three CLI binaries alongside the app, no manual installation needed:

| Binary | Purpose | Project |
|--------|---------|---------|
| `whisper-cli` | Speech-to-text transcription | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| `llama-completion` | Local LLM inference for summarization | [llama.cpp](https://github.com/ggerganov/llama.cpp) |
| `yt-dlp` | Audio download from YouTube / Facebook URLs | [yt-dlp](https://github.com/yt-dlp/yt-dlp) |

All processing happens on your machine. `yt-dlp` only contacts the internet to fetch the requested URL; `whisper-cli` and `llama-completion` run fully offline.

## Installation

### macOS
1. Download the `.dmg` file from [Releases](../../releases)
2. Open the file and drag the app to Applications
3. Open Terminal and run:
   ```bash
   xattr -cr /Applications/beautiful\ speech\ to\ text.app
   ```
4. Now you can open the app normally and enjoy!

> **Why is this needed?** macOS blocks apps that aren't signed with an Apple Developer certificate ($99/year). This is standard for open source software. The command above removes the quarantine flag that macOS adds to downloaded apps.

### Windows
1. Download the `.msi` file from [Releases](../../releases)
2. Run the installer and follow the prompts
3. if "Windows preogetió su PC" or similar message appears, click on "more information" and "Ejecutar de todas formas"
4. Run next, next, next and finish. Enjoy!

> **Why is this needed?** Windows blocks apps that aren't signed with an Apple Developer certificate. This is standard for open source software. The step above removes the quarantine flag that Windows adds to downloaded apps.

### Linux

Choose the package format for your distribution:

**Debian / Ubuntu**
1. Download the `.deb` file from [Releases](../../releases)
2. Install it (replace `<version>` with the downloaded version):
   ```bash
   sudo dpkg -i Beautiful-STT_<version>_amd64.deb
   ```

**Fedora / RHEL / openSUSE**
1. Download the `.rpm` file from [Releases](../../releases)
2. Install it (replace `<version>` with the downloaded version):
   ```bash
   sudo rpm -i Beautiful-STT_<version>-1.x86_64.rpm
   ```

**Universal (AppImage)**
1. Download the `.AppImage` file from [Releases](../../releases)
2. Make it executable and run (replace `<version>` with the downloaded version):
   ```bash
   chmod +x Beautiful-STT_<version>_amd64.AppImage
   ./Beautiful-STT_<version>_amd64.AppImage
   ```

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 8 GB | 16 GB |
| GPU VRAM | 4 GB | 6+ GB |
| Storage | 6 GB (for models) | 12 GB available SSD |

### Supported GPUs
- **macOS**: Apple Silicon (M1/M2/M3) with Metal
- **Windows/Linux**: NVIDIA GPUs with CUDA

## First Run

On first launch, the app will download the Whisper/Llama models (400MB ~3 GB depending on the model size). This only happens once for model.

## License

Open source - MIT License

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## Next Steps

### Quick wins
- **Language selection** Whisper supports many languages but the app is currently hardcoded to Spanish. Exposing this as a UI option unlocks the full model capability with no pipeline changes.
- **Export results** Add export to `.txt` or `.md` via `tauri-plugin-fs` (already a project dependency). Currently only copy-to-clipboard is available.
- **Cancellation** No way to stop a transcription in progress. A long audio file forces the user to close the app entirely.

### Medium-impact features
- **Model download progress** Models range from 500 MB to 9 GB and download silently. The first use of any model looks like a crash. A real progress bar is needed.
- **Extracted entities in the UI** The backend already extracts structured JSON (people, dates, organizations, figures) via Gemma in detailed mode, but this data never reaches the frontend. Displaying it as a dedicated panel would be a meaningful differentiator.
- **Session history** Persist transcriptions and summaries in `localStorage` or SQLite (Tauri has a plugin) so work isn't lost on close.

### Technical improvements
- **GPU/CPU fallback** `n_gpu_layers(99)` assumes unlimited VRAM. On low-VRAM hardware the process crashes silently. This needs a configurable limit or at least a graceful CPU fallback.
- **Batch processing** The pipeline is already reusable. Extending the UI to accept a queue of files is the main work.
- **Direct microphone recording** The natural use case is recording a meeting or voice note directly in the app, not only loading pre-recorded files.

### Longer term
- **Global shortcut / system plugin**  A system-wide hotkey to start recording from any app, similar to Whisper Flow or SuperWhisper. Tauri supports global shortcuts.
- **Timestamps in the transcript**  Whisper produces per-segment timestamps internally but they aren't surfaced in the UI. Useful for navigating long audio (click text → jump to that minute).

## Build from source
## MAC OS
```bash
set -gx CXXFLAGS "-mmacosx-version-min=11.0 -std=c++17"
set -gx CFLAGS "-mmacosx-version-min=11.0"
set -gx MACOSX_DEPLOYMENT_TARGET 11.0
set -gx CMAKE_OSX_DEPLOYMENT_TARGET 11.0
CMAKE_GENERATOR="Unix Makefiles" CMAKE_POLICY_VERSION_MINIMUM=3.5 pnpm tauri build
```

## LINUX

```bash
APPIMAGE_EXTRACT_AND_RUN=1 pnpm tauri build
```

> On Debian/Ubuntu, the AppImage bundling step needs `librsvg2-dev` (provides
> `librsvg-2.0.pc` for the linuxdeploy GTK plugin). Install it first:
> `sudo apt install librsvg2-dev`.

## WIN

### GPU

```Powershell
pnpm tauri build
```

### CUDA
```Powershell
# first time (download whisper-cli zip)
.\scripts\build-windows-cuda.ps1

# second time  (without download zip)
.\scripts\build-windows-cuda.ps1 -SkipDownload

# diferent version of whisper.cpp
.\scripts\build-windows-cuda.ps1 -WhisperVersion v1.8.4 -SkipDownload
```

## Where models are stored

Models (Whisper, VAD and LLM) are **not** stored next to the binary, inside an
AppImage that location is read-only and writing fails with
`Permission denied (os error 13)`. Instead they go to the user's data directory
(`dirs::data_dir()` + `beautiful-stt`):

| Platform | Location |
|----------|----------|
| **Linux**   | `$XDG_DATA_HOME/beautiful-stt/` or `~/.local/share/beautiful-stt/` |
| **macOS**   | `~/Library/Application Support/beautiful-stt/` |
| **Windows** | `C:\Users\<user>\AppData\Roaming\beautiful-stt\` |

Layout inside that folder:

```
beautiful-stt/
├── ggml-<model>.bin          # Whisper models
├── ggml-silero-v5.1.2.bin    # VAD model
└── llm_models/
    └── <model>.gguf          # summarization LLMs
```

To free disk space or force a re-download, delete the relevant file(s); they are
fetched again on next use.
