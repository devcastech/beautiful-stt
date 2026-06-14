use std::process::Command;
use std::sync::Arc;

pub type EmitType = Arc<dyn Fn(&str, &str, Option<u32>) + Send + Sync>;

pub struct DownloaderProcessor {
    emit: EmitType,
    audio_url: String,
}

impl DownloaderProcessor {
    pub fn new(emit: EmitType, audio_url: String) -> Self {
        Self { emit, audio_url }
    }

    pub fn download(&self) -> String {
        let audio_url = self.audio_url.clone();
        (self.emit)(
            "process",
            &format!("Descargando audio de {}", audio_url),
            None,
        );

        let yt_dlp_bin = self.get_ytdlp_bin_path();
        let tmp_dir = std::env::temp_dir();
        let file_path = tmp_dir.join("beautiful-stt-download.%(ext)s");
        let file_path_str = file_path.to_string_lossy();
        let output = match Command::new(&yt_dlp_bin)
            .arg("-f")
            .arg("bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio")
            .arg("--output")
            .arg(file_path_str.as_ref())
            .arg("--force-overwrites")
            .arg("--print")
            .arg("after_move:filepath")
            .arg(audio_url)
            .output()
        {
            Ok(o) => o,
            Err(e) => {
                (self.emit)("error", &format!("Error al descargar: {}", e), None);
                return String::new();
            }
        };

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let last_line = stderr.lines().last().unwrap_or("error desconocido");
            (self.emit)("process", &format!("yt-dlp falló: {}", last_line), None);
            return String::new();
        }

        let downloaded_audio_path = String::from_utf8_lossy(&output.stdout).trim().to_string();

        let filename = std::path::Path::new(&downloaded_audio_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&downloaded_audio_path);
        (self.emit)(
            "process",
            &format!("Descarga finalizada: {}", filename),
            None,
        );

        downloaded_audio_path
    }

    pub fn get_ytdlp_bin_path(&self) -> std::path::PathBuf {
        let bin_name = if cfg!(target_os = "windows") {
            "yt-dlp.exe"
        } else {
            "yt-dlp"
        };

        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_default();

        let yt_dlp_bin = exe_dir.join(bin_name);
        if yt_dlp_bin.exists() {
            return yt_dlp_bin;
        }

        std::path::PathBuf::from(bin_name)
    }
}
