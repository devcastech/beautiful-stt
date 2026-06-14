pub fn models_base_dir() -> std::path::PathBuf {
    let base = dirs::data_dir()
        .map(|d| d.join("beautiful-stt"))
        .unwrap_or_else(|| {
            // Fallback
            std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .unwrap_or_default()
        });
    let _ = std::fs::create_dir_all(&base);
    base
}

pub fn detect_gpu() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "Metal"
    }

    #[cfg(target_os = "windows")]
    {
        let nvidia = std::process::Command::new("nvidia-smi")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        if nvidia { "CUDA" } else { "CPU" }
    }

    #[cfg(target_os = "linux")]
    {
        let nvidia = std::process::Command::new("nvidia-smi")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        if nvidia { "CUDA" } else { "CPU" }
    }
}
