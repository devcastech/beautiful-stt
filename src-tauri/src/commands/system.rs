use crate::gpu::{self, Gpu};
use crate::utils;

#[tauri::command]
pub async fn detect_gpu() -> Result<String, String> {
    let backend = utils::detect_gpu();
    Ok(backend.to_string())
}

#[tauri::command]
pub async fn get_gpus() -> Vec<Gpu> {
    gpu::gpus().to_vec()
}
