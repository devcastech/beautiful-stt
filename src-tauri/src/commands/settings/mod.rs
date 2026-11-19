use std::time::UNIX_EPOCH;

use serde::Serialize;

use crate::utils;

#[derive(Serialize, Debug)]
pub struct ModelInfo {
    #[serde(flatten)]
    model: &'static DefaultModel,
    modified: Option<u64>,
    downloaded: bool,
    disk_size: Option<u64>,
}

#[derive(Serialize, Debug)]
pub struct DefaultModel {
    pub name: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub default: bool,
    pub size: u64,
}

pub const DEFAULT_MODELS: &[DefaultModel] = &[
    DefaultModel {
        name: "ggml-tiny.bin",
        label: "Tiny",
        description: "Extra rápido · menos preciso",
        default: false,
        size: 77_691_713,
    },
    DefaultModel {
        name: "ggml-small-q8_0.bin",
        label: "Small Q8_0",
        description: "Rápido · menos preciso",
        default: false,
        size: 264_464_607,
    },
    DefaultModel {
        name: "ggml-small.bin",
        label: "Small",
        description: "Rápido · preciso",
        default: true,
        size: 487_601_967,
    },
    DefaultModel {
        name: "ggml-large-v3-turbo-q8_0.bin",
        label: "Large Turbo Q8",
        description: "Rápido · preciso",
        default: false,
        size: 874_188_075,
    },
    DefaultModel {
        name: "ggml-large-v3-turbo.bin",
        label: "Large Turbo",
        description: "Lento · más preciso · requiere más recursos",
        default: false,
        size: 1_624_555_275,
    },
    DefaultModel {
        name: "ggml-large-v3.bin",
        label: "Large v3",
        description: "Lento · ultra preciso",
        default: false,
        size: 3_095_033_483,
    },
];

#[tauri::command]
pub async fn get_models() -> Result<Vec<ModelInfo>, String> {
    let dir = utils::models_base_dir();
    let models = DEFAULT_MODELS
        .iter()
        .map(|m| {
            let meta = std::fs::metadata(dir.join(m.name)).ok();

            ModelInfo {
                model: m,
                downloaded: meta.is_some(),
                disk_size: meta.as_ref().map(|m| m.len()),
                modified: meta
                    .and_then(|meta| meta.modified().ok())
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_secs()),
            }
        })
        .collect();

    Ok(models)
}

//#[tauri::command]
//pub async fn get_models() -> Result<Vec<ModelInfo>, String> {
//    let dir = utils::models_base_dir();
//    println!("Models base dir: {:?}", dir);
//    let models_content = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
//
//    println!("models: {:?}", models_content);
//    let mut models: Vec<ModelInfo> = Vec::new();
//    for entry in models_content {
//        let entry = entry.map_err(|e| e.to_string())?;
//        let meta = entry.metadata().map_err(|e| e.to_string())?;
//        let path = entry.path();
//        if path.extension().and_then(|s| s.to_str()) != Some("bin") {
//            continue;
//        }
//        let downloaded = DEFAULT_MODELS.iter().any(|m| m.name == entry.file_name());
//
//        models.push(ModelInfo {
//            name: entry.file_name().to_string_lossy().to_string(),
//            size: meta.len(),
//            downloaded,
//            modified: meta
//                .modified()
//                .ok()
//                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
//                .map(|d| d.as_secs()),
//        })
//    }
//    println!("models: {:?}", models);
//    models.sort_by(|a, b| a.size.cmp(&b.size));
//    Ok(models)
//}

#[tauri::command]
pub async fn delete_model(model: &str) -> Result<String, String> {
    let model = DEFAULT_MODELS
        .iter()
        .find(|m| m.name == model)
        .ok_or_else(|| format!("Unknown model: {model}"))?;

    let model_path = crate::utils::models_base_dir().join(model.name);

    match std::fs::remove_file(&model_path) {
        Ok(()) => Ok("Deleted".to_string()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok("Deleted".to_string()),
        Err(e) => Err(format!("Could not delete {}: {e}", model.name)),
    }
}
