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