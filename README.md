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

**Beautiful STT runs 100% locally.** Your audio never leaves your machine.

## Features

- Fully local processing - no internet required after model download
- Supports multiple audio formats (MP3, WAV, FLAC, OGG, AAC)
- Automatic noise reduction
- GPU acceleration (Metal on macOS, CUDA on Windows/Linux)
- Uses from tiny for less resources machine to large-v3 whisper models for high accuracy on more resources machine

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
Coming soon

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 8 GB | 16 GB |
| GPU VRAM | 4 GB | 6+ GB |
| Storage | 3 GB (for model) | SSD |

### Supported GPUs
- **macOS**: Apple Silicon (M1/M2/M3) with Metal
- **Windows/Linux**: NVIDIA GPUs with CUDA

## First Run

On first launch, the app will download the Whisper model (100MB ~3 GB depending on the model size). This only happens once for model.

## License

Open source - MIT License

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

set -gx CXXFLAGS "-mmacosx-version-min=11.0 -std=c++17"
set -gx CFLAGS "-mmacosx-version-min=11.0"
set -gx MACOSX_DEPLOYMENT_TARGET 11.0
set -gx CMAKE_OSX_DEPLOYMENT_TARGET 11.0
