use tauri::AppHandle;

use super::make_emit;
use crate::transcript_processor;

#[tauri::command]
pub async fn process_audio_file(
    app: AppHandle,
    file_path: String,
    whisper_model: &str,
) -> Result<String, String> {
    let emit = make_emit(app);
    let processor =
        transcript_processor::TranscriptProcessor::new(emit, file_path, whisper_model.to_string());
    Ok(processor.process())
}
