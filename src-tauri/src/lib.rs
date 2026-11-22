use std::{string::String, sync::Mutex};
mod audio_decoder;
mod commands;
mod downloader;
mod models;
mod settings;
mod transcript_processor;
mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(settings::load()))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::files::save_text_file,
            commands::system::detect_gpu,
            commands::transcript::process_audio_file,
            commands::downloader::download_audio,
            commands::settings::get_models,
            commands::settings::delete_model,
            commands::settings::ensure_default_models,
            commands::settings::get_settings,
            commands::settings::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
