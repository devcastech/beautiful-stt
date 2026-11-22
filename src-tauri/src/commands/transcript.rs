use tauri::{AppHandle, State};

use super::make_emit;
use crate::settings::{self, SettingsState};
use crate::transcript_processor::{TranscriptProcessor, TranscriptionOutput, TranscriptionParams};

#[tauri::command]
pub async fn process_audio_file(
    app: AppHandle,
    state: State<'_, SettingsState>,
    file_path: String,
    whisper_model: &str,
) -> Result<TranscriptionOutput, String> {
    let settings = settings::current(&state)?;
    let processor = TranscriptProcessor::new(
        make_emit(app),
        file_path,
        whisper_model.to_string(),
        settings,
    );
    Ok(processor.process())
}

#[tauri::command]
pub async fn get_transcription_params(
    state: State<'_, SettingsState>,
    model: &str,
) -> Result<TranscriptionParams, String> {
    let settings = settings::current(&state)?;
    Ok(TranscriptionParams::resolve(&settings, model))
}
