#[tauri::command]
pub async fn save_text_file(path: String, contents: String) -> Result<String, String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok("Saved".to_string())
}
