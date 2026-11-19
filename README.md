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
- Supports multiple audio formats (MP3, WAV, OGG, FLAC, AAC, OPUS, M4A)
- Download audio directly from YouTube and Facebook URLs via `yt-dlp`
- Transcript as plain text or with timestamps, ready to copy or save to a file
- Dark mode and accessibility support
- Voice activity detection (Silero VAD) to skip silence
- GPU acceleration (Metal on macOS, Vulkan on Windows/Linux with automatic CPU fallback, optional CUDA build on Windows)
- Uses from tiny to large-v3 Whisper models depending on available resources
- Manage Whisper models from the app: download, delete and check their size on disk

## Bundled binaries

Beautiful STT ships these CLI binaries alongside the app, no manual installation needed:

| Binary | Purpose | Project |
|--------|---------|---------|
| `whisper-cli` | Speech-to-text transcription (CPU, Metal on macOS) | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| `whisper-cli-vulkan` | Same, GPU-accelerated via Vulkan (Windows/Linux) | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| `yt-dlp` | Audio download from YouTube / Facebook URLs | [yt-dlp](https://github.com/yt-dlp/yt-dlp) |

All processing happens on your machine. `yt-dlp` only contacts the internet to fetch the requested URL; `whisper-cli` runs fully offline.

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
| GPU | none (CPU works) | 4+ GB VRAM |
| Storage | 6 GB (for models) | 12 GB available SSD |

### Supported GPUs
- **macOS**: Apple Silicon (M1/M2/M3) with Metal
- **Windows/Linux**: any GPU with a Vulkan driver (AMD, Intel, NVIDIA). The app
  tries the GPU first and falls back to CPU automatically. NVIDIA cards can
  also use a dedicated CUDA build on Windows.

> Integrated AMD GPUs on Windows gain little: the driver only gives the GPU the
> VRAM reserved by the BIOS (often 512 MB) and larger models run from system
> RAM. Details and workarounds in [BUILD.md](BUILD.md#gpu-at-runtime-windowslinux).

## First Run

On first launch, the app downloads the default Whisper model (Small, ~488 MB) and the VAD model, showing the progress on a setup screen. Other models can be downloaded from **Configuración → Modelos**, or download automatically the first time you transcribe with them.

## License

Open source - MIT License

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.
To build the app or rebuild the bundled binaries, see [BUILD.md](BUILD.md).

## Next Steps

### Quick wins
- **Language selection** Whisper supports many languages but the app is currently hardcoded to Spanish. Exposing this as a UI option unlocks the full model capability with no pipeline changes.
- **Cancellation** No way to stop a transcription in progress. A long audio file forces the user to close the app entirely.

### Medium-impact features
- **Session history** Persist transcriptions in `localStorage` or SQLite (Tauri has a plugin) so work isn't lost on close.

### Technical improvements
- **Batch processing** The pipeline is already reusable. Extending the UI to accept a queue of files is the main work.
- **Direct microphone recording** The natural use case is recording a meeting or voice note directly in the app, not only loading pre-recorded files.

### Longer term
- **Global shortcut / system plugin**  A system-wide hotkey to start recording from any app, similar to Whisper Flow or SuperWhisper. Tauri supports global shortcuts.
- **Click-to-seek timestamps** Timestamps are shown in the transcript, but clicking one doesn't jump to that point in the audio preview. Useful for navigating long audio.

## Where models are stored

Models (Whisper and VAD) are **not** stored next to the binary, inside an
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
└── ggml-silero-v6.2.0.bin    # VAD model
```

To free disk space, delete Whisper models from **Configuración → Modelos**, or
delete the files by hand; they are downloaded again on next use. A
`<model>.part` file is an unfinished download and can be deleted safely while
the app isn't downloading.
