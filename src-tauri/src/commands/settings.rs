use super::make_emit;
use crate::models;
use crate::settings::{self, AppSettings, SettingsState};
use crate::transcript_processor;
use tauri::AppHandle;
use tauri::State;

#[tauri::command]
pub async fn get_models() -> Result<Vec<models::ModelInfo>, String> {
    Ok(models::get_models())
}

#[tauri::command]
pub async fn delete_model(model: &str) -> Result<String, String> {
    models::delete_model(model)?;
    Ok("Deleted".to_string())
}

#[tauri::command]
pub async fn ensure_default_models(
    app: AppHandle,
    file_path: String,
    whisper_model: &str,
) -> Result<String, String> {
    let emit = make_emit(app);
    //TODO: move models handling to a separate module
    let processor =
        transcript_processor::TranscriptProcessor::new(emit, file_path, whisper_model.to_string());
    Ok(processor.ensure_default_models())
}

#[tauri::command]
pub async fn get_settings(state: State<'_, SettingsState>) -> Result<AppSettings, String> {
    let current = state.lock().map_err(|e| e.to_string())?;
    Ok(current.clone())
}

#[tauri::command]
pub async fn save_settings(
    state: State<'_, SettingsState>,
    new_settings: AppSettings,
) -> Result<AppSettings, String> {
    let mut current = state.lock().map_err(|e| e.to_string())?;
    settings::save(&new_settings)?;
    *current = new_settings.clone();
    Ok(new_settings)
}
