use super::make_emit;
use tauri::AppHandle;

use crate::downloader;

#[tauri::command]
pub async fn download_audio(
    app: AppHandle,
    audio_url: String,
) -> Result<downloader::DownloadResult, String> {
    let emit = make_emit(app);
    let downloader = downloader::DownloaderProcessor::new(emit, audio_url);
    tauri::async_runtime::spawn_blocking(move || downloader.download())
        .await
        .map_err(|e| e.to_string())
}
