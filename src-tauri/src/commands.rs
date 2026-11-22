use std::sync::Arc;
pub mod downloader;
pub mod settings;
pub mod transcript;
pub mod system;
pub mod files;

use crate::utils::EmitType;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct ProcessEvent {
    event: String,
    step: String,
    count: Option<u32>,
}

fn make_emit(app: AppHandle) -> EmitType {
    Arc::new(move |event: &str, step: &str, count: Option<u32>| {
        app.emit(
            "process",
            ProcessEvent {
                event: event.into(),
                step: step.into(),
                count,
            },
        )
        .unwrap();
    })
}
