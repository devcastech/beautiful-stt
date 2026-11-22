use std::{path::PathBuf, sync::Mutex};

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default)]
pub struct AppSettings {
    pub default_model: String,
    pub beam_size: Option<u8>,
    pub use_gpu: bool,
    pub vad: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_model: "ggml-small.bin".into(),
            beam_size: None,
            use_gpu: true,
            vad: true,
        }
    }
}

pub type SettingsState = Mutex<AppSettings>;

pub fn current(state: &SettingsState) -> Result<AppSettings, String> {
    state.lock().map(|s| s.clone()).map_err(|e| e.to_string())
}

fn path() -> PathBuf {
    crate::utils::models_base_dir().join("settings.json")
}

pub fn load() -> AppSettings {
    std::fs::read_to_string(path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(settings: &AppSettings) -> Result<(), String> {
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(path(), json).map_err(|e| e.to_string())
}
