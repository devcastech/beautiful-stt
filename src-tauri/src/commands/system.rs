use crate::gpu::{self, Gpu};

#[tauri::command]
pub async fn get_gpus() -> Vec<Gpu> {
    gpu::gpus().to_vec()
}
