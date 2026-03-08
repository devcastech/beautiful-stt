// use serde_json::Value::String;
use std::string::String;
use std::sync::Arc;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
mod utils;
mod audio_processor;
mod summarizer;

#[derive(Clone, Serialize)]
struct ProcessEvent {
    event: String,
    step: String,
    count: Option<u32>,
}

#[tauri::command]
async fn detect_gpu() -> Result<String, String> {
    let backend = utils::detect_gpu();
    Ok(backend.to_string())
}

#[tauri::command]
async fn process_audio_file(app: AppHandle, file_path: String, whisper_model: &str) -> Result<String, String> {
    let emit: Arc<dyn Fn(&str, &str,  Option<u32>) + Send + Sync> = Arc::new(move |event: &str, step: &str, count: Option<u32>| {
        app.emit("process", ProcessEvent { event: event.into(), step: step.into(), count }).unwrap();
    });
    let processor = audio_processor::AudioProcessor::new(
        emit,
        file_path,
        whisper_model.to_string()
    );
    Ok(processor.process())
    // audio_processor::process_audio_file(emit, &file_path, Some(whisper_model))
}

#[tauri::command]
async fn summarize_transcript(
    app: AppHandle,
    transcript: String,
    llm_model: Option<String>,
    output_mode: Option<String>,
) -> Result<String, String> {
    let emit: Arc<dyn Fn(&str, &str, Option<u32>) + Send + Sync> =
        Arc::new(move |event: &str, step: &str, count: Option<u32>| {
            app.emit( "process", ProcessEvent { event: event.into(), step: step.into(), count, }, ).unwrap();
        });

    summarizer::summarize_transcript(emit, &transcript, llm_model.as_deref(), output_mode.as_deref())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![detect_gpu, process_audio_file, summarize_transcript])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
