pub type EmitType = std::sync::Arc<dyn Fn(&str, &str, Option<u32>) + Send + Sync>;

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
