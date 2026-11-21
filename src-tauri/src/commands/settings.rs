use super::make_emit;
use crate::models;
use crate::transcript_processor;
use tauri::AppHandle;

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
