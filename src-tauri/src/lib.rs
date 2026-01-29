mod audio_processor;
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn process_audio_file(file_path: String) -> Result<String, String> {
    audio_processor::process_audio_file(&file_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet, process_audio_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
