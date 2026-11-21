## [1.4.0] - 2026-11-19

### 🚀 Features

- *(settings)* Open settings from footer toggle
- *(transcript)* Load models from backend in custom select
- *(settings)* Delete downloaded models
- *(transcript)* Show setup screen while models download

### 🐛 Bug Fixes

- *(settings)* Handle errors when deleting a model
- *(models)* Handle failed and partial downloads

### 📚 Documentation

- Update readme for v1.4.0

### 🚜 Refactor

- *(settings)* Split settings view into components
- *(transcript)* Move AudioProcessor to views/transcript

### 🎨 Styling

- *(ui)* Adjust border colors and theme toggle
## [1.3.0] - 2026-11-15

### 🚀 Features

- *(stt)* Add Vulkan GPU transcription on Linux
- *(models)* Add large-v3-turbo q8 model
- *(stt)* Add Vulkan GPU transcription on Windows

### ⚙️ Miscellaneous Tasks

- *(stt)* Drop whisper prompt and segments log
## [1.2.9] - 2026-11-01

### 🐛 Bug Fixes

- *(build)* Disable openssl in llama.cpp build
## [1.2.8] - 2026-11-01

### 🐛 Bug Fixes

- *(windows)* Ajusted mac controls margin
- *(updater)* Bump tauri cli to 2.11.5
## [1.2.7] - 2026-08-25

### 🚀 Features

- *(transcript)* Add save-to-file option for transcripts
## [1.2.4] - 2026-08-20

### ⚙️ Miscellaneous Tasks

- *(release)* Update pnpm version
- *(release)* Remove local dev config
## [show] - 2026-08-20

### 🚀 Features

- *(window)* Add custom draggable titlebar with window controls
- *(downloader)* Added original source title
- *(transcribe)* Tune whisper params, add m4a support and model options
- *(models)* Stream model downloads with progress and prefetch on load
- *(updater)* Add in-app auto-update support

### 🐛 Bug Fixes

- *(audio)* Use actual decoded sample rate instead of codec header for HE-AAC
- *(downloader)* Retry yt-dlp download on failure with basic backoff
- Fixed typos

### 📚 Documentation

- Updated docs

### 🚜 Refactor

- *(ui)* Remove summary feature from AudioProcessor

### ⚙️ Miscellaneous Tasks

- *(release)* Add publish workflow, bump version to 1.2.4
## [1.2.0-beta.2] - 2026-06-14

### 🚀 Features

- *(stt)* Structured transcript output + editorial theme
- Add Windows CUDA build script and approve esbuild builds
- *(downloader)* Add yt-dlp integration for YouTube/Facebook audio download
- *(audio)* Add M4A/MP4 support and improve audio decoder robustness

### 🐛 Bug Fixes

- Store models in user data dir instead of next to binary
- Resolve Windows download and llama GPU issues
## [1.1.0-beta.1] - 2026-03-22

### 🚀 Features

- *(ui)* Redesign layout with bento sections and improved contrast
- *(tauri)* Switch STT backend to bundled whisper-cli`

### ⚙️ Miscellaneous Tasks

- Update version

### 💼 Other

- Add win cpu blas binaries
## [1.0.0-beta.1] - 2026-03-08

### 🚀 Features

- Implement chunked summarization for long transcripts
- Add support for new LLM models and improve prompt formatting
- Add acta (meeting minutes) output mode with improved transcription quality
- Add Ministral-8B-Instruct-2410 (Q4_K_S) LLM model
- Add Gemma entity extraction as grounding context for summaries
- Redesign UI + simplify summary modes
- *(ui,summarizer)* Improve layout, contextual progress, and Gemma diagnostics

### 🐛 Bug Fixes

- Chunked transcription to prevent loop contamination + acta classification

### 💼 Other

- AI-Powered Transcript Summarization
## [0.2.0-beta.2] - 2026-02-15

### 🚀 Features

- Streaming transcription, GPU detection, and emit refactor
## [0.2.0-beta.1] - 2026-02-14

### 🚀 Features

- Add progress indicators
- Improve ui/ux

### 📚 Documentation

- Update readme
## [0.1.0] - 2026-01-29
