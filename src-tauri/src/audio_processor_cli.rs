use std::{fs::File, time::Instant};
use std::sync::Arc;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::thread;
#[path = "audio_processor/audio_decoder/mod.rs"]
mod audio_decoder;

pub type EmitType = Arc<dyn Fn(&str, &str, Option<u32>) + Send + Sync>;

const VAD_MODEL_NAME: &str = "ggml-silero-v6.2.0.bin";
const VAD_MODEL_URL: &str = "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin";

pub struct AudioProcessor {
    emit: EmitType,
    file_path: String,
    whisper_model: String,
}

impl AudioProcessor {
    pub fn new(emit: EmitType, file_path: String, whisper_model: String) -> Self {
        AudioProcessor { emit, file_path, whisper_model }
    }

    pub fn process(&self) -> String {
        println!("[STT] process() start — file={} model={}", self.file_path, self.whisper_model);
        (self.emit)("process", &format!("validando disponibilidad del modelo {}", self.whisper_model), None);
        if let Err(e) = self.ensure_model(&*self.emit, &self.whisper_model) {
            println!("[STT] ensure_model failed: {}", e);
            (self.emit)("process", "hubo un error descargando el modelo", None);
            return format!("failed to ensure model: {}", e);
        }

        let vad_path = match self.ensure_vad_model(&*self.emit) {
            Ok(path) => Some(path),
            Err(e) => {
                println!("VAD model not available, proceeding without VAD: {}", e);
                (self.emit)("process", "VAD no disponible, continuando sin filtro de voz", None);
                None
            }
        };

        let total = Instant::now();

        // Whisper-cli soporta nativamente: wav, mp3, flac, ogg
        // Para otros formatos (m4a, opus, etc.) convertimos a WAV temporal
        let ext = std::path::Path::new(&self.file_path)
            .extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        println!("[STT] file ext={}", ext);
        let native_formats = ["wav", "mp3", "flac"];
        let (audio_path, temp_wav) = if native_formats.contains(&ext.as_str()) {
            println!("[STT] native format, passing directly");
            (self.file_path.clone(), None)
        } else {
            println!("[STT] non-native format, converting via prepare_wav");
            (self.emit)("process", "convirtiendo audio", None);
            match self.prepare_wav(&self.file_path) {
                Ok(p) => {
                    println!("[STT] prepare_wav ok: {}", p.display());
                    let s = p.to_str().unwrap().to_string();
                    (s, Some(p))
                }
                Err(e) => {
                    println!("[STT] prepare_wav failed: {}", e);
                    (self.emit)("process", &format!("Error decodificando audio: {}", e), None);
                    return format!("error: {}", e);
                }
            }
        };

        println!("[STT] calling transcribe with audio_path={}", audio_path);
        (self.emit)("process", "iniciando transcripción", None);
        let text = self.transcribe(&audio_path, vad_path.as_deref());
        if let Some(p) = temp_wav {
            let _ = std::fs::remove_file(p);
        }

        let elapsed = total.elapsed().as_secs();
        (self.emit)("process", &format!("Proceso completado en {:?} segundos", elapsed), None);
        text
    }

    /// Resuelve la ruta del binario whisper-cli.
    /// En producción (bundle): junto al ejecutable (dylibs en ../Frameworks/).
    /// En desarrollo: homebrew o sistema (tiene sus propios dylibs).
    pub fn get_whisper_bin_path(&self) -> std::path::PathBuf {
        let bin_name = if cfg!(target_os = "windows") { "whisper-cli.exe" } else { "whisper-cli" };

        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_default();

        // En producción el binario bundleado va primero (dylibs en ../Frameworks/ listos).
        // En dev NO usamos el binario copiado por Tauri en target/debug/ porque sus rpaths
        // apuntan a ../Frameworks/ que no existe en modo dev — usamos homebrew/sistema primero.
        #[cfg(not(debug_assertions))]
        {
            let next_to_exe = exe_dir.join(bin_name);
            if next_to_exe.exists() { return next_to_exe; }
        }

        // macOS: homebrew (ARM y Intel)
        #[cfg(target_os = "macos")]
        for prefix in &["/opt/homebrew/bin", "/usr/local/bin"] {
            let p = std::path::PathBuf::from(prefix).join(bin_name);
            if p.exists() { return p; }
        }

        // Fallback: next to exe (producción sin Frameworks, o PATH del sistema)
        let next_to_exe = exe_dir.join(bin_name);
        if next_to_exe.exists() { return next_to_exe; }

        std::path::PathBuf::from(bin_name)
    }

    pub fn get_model_path(&self, name: &str) -> std::path::PathBuf {
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_default()
            .join(name)
    }

    pub fn ensure_model(&self, emit: &dyn Fn(&str, &str, Option<u32>), whisper_model: &str) -> Result<(), Box<dyn std::error::Error>> {
        let model_path = self.get_model_path(whisper_model);
        if !model_path.exists() {
            let model_url = format!(
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{}",
                whisper_model
            );
            emit("process", &format!("aprovisionando modelo de IA localmente {}", whisper_model), None);
            let mut response = ureq::get(&model_url).call()?.into_reader();
            let mut file = File::create(&model_path)?;
            std::io::copy(&mut response, &mut file)?;
        }
        Ok(())
    }

    pub fn ensure_vad_model(&self, emit: &dyn Fn(&str, &str, Option<u32>)) -> Result<std::path::PathBuf, Box<dyn std::error::Error>> {
        let vad_path = self.get_model_path(VAD_MODEL_NAME);
        if !vad_path.exists() {
            emit("process", "Descargando modelo VAD (solo una vez, ~885KB)", None);
            let mut response = ureq::get(VAD_MODEL_URL).call()?.into_reader();
            let mut file = File::create(&vad_path)?;
            std::io::copy(&mut response, &mut file)?;
        }
        Ok(vad_path)
    }

    pub fn prepare_wav(&self, file_path: &str) -> Result<std::path::PathBuf, Box<dyn std::error::Error>> {
        let audio = audio_decoder::decode(file_path)?;
        let temp_path = std::env::temp_dir().join("beautiful_stt_input.wav");
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: audio.sample_rate,
            bits_per_sample: 32,
            sample_format: hound::SampleFormat::Float,
        };
        let mut writer = hound::WavWriter::create(&temp_path, spec)?;
        for sample in &audio.samples {
            writer.write_sample(*sample)?;
        }
        writer.finalize()?;
        Ok(temp_path)
    }

    pub fn transcribe(&self, file_path: &str, vad_model_path: Option<&std::path::Path>) -> String {
        let whisper_bin = self.get_whisper_bin_path();
        let model_path = self.get_model_path(&self.whisper_model);
        println!("[STT] whisper_bin={} exists={}", whisper_bin.display(), whisper_bin.exists());
        println!("[STT] model_path={} exists={}", model_path.display(), model_path.exists());

        let mut cmd = Command::new(&whisper_bin);

        // En producción macOS, los dylibs están en ../Frameworks/ relativo al exe.
        // Aunque el rpath está patched, forzamos DYLD_LIBRARY_PATH por robustez.
        #[cfg(all(target_os = "macos", not(debug_assertions)))]
        {
            let frameworks_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().and_then(|p| p.parent()).map(|p| p.join("Frameworks")))
                .unwrap_or_default();
            if frameworks_dir.exists() {
                println!("[STT] setting DYLD_LIBRARY_PATH={}", frameworks_dir.display());
                cmd.env("DYLD_LIBRARY_PATH", &frameworks_dir);
            }
        }

        cmd.arg("-m").arg(model_path.to_str().unwrap())
           .arg("-f").arg(file_path)
           .arg("-l").arg("es")
           .arg("-bs").arg("5")            // beam size
           .arg("-sns")                    // suppress non-speech tokens
           .arg("--prompt")
           .arg("Transcripción profesional de audio. Contenido formal, sin publicidad, sin menciones a redes sociales ni suscripciones.")
           .arg("-pp")                     // print-progress: emite % al stderr
           .stdout(Stdio::piped())
           .stderr(Stdio::piped());

        if let Some(vad_path) = vad_model_path {
            cmd.arg("--vad")
               .arg("-vm").arg(vad_path.to_str().unwrap())
               .arg("-vt").arg("0.5")      // vad threshold (default)
               .arg("-vspd").arg("300")    // min speech duration ms
               .arg("-vsd").arg("100")     // min silence duration ms
               .arg("-vp").arg("30");      // speech pad ms
        }

        // Debug: mostrar comando exacto
        let cmd_str = format!("{} -m {} -f {}", whisper_bin.display(), model_path.display(), file_path);
        (self.emit)("process", &format!("cmd: {}", cmd_str), None);

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let msg = format!("Error al ejecutar whisper-cli ({}): {}", whisper_bin.display(), e);
                (self.emit)("process", &msg, None);
                return msg;
            }
        };

        // Thread separado para leer progreso de stderr sin bloquear stdout
        let stderr = child.stderr.take().expect("Failed to capture stderr");
        let emit_progress = self.emit.clone();
        let stderr_thread = thread::spawn(move || {
            let reader = BufReader::new(stderr);
            let mut lines_collected: Vec<String> = Vec::new();
            for line in reader.lines() {
                let Ok(line) = line else { continue };
                if let Some(pct) = parse_progress_line(&line) {
                    emit_progress("process", "transcribiendo", Some(pct));
                } else {
                    lines_collected.push(line);
                }
            }
            lines_collected
        });

        let stdout = child.stdout.take().expect("Failed to capture stdout");
        let reader = BufReader::new(stdout);
        let mut full_text = String::new();
        let mut segment_idx: u32 = 0;

        for line in reader.lines() {
            let Ok(line) = line else { continue };
            if let Some(text) = parse_whisper_segment(&line) {
                if has_transcription_loop(text) {
                    (self.emit)("process", &format!("segmento {} omitido (loop)", segment_idx + 1), None);
                    segment_idx += 1;
                    continue;
                }
                (self.emit)("transcript_segment", text, Some(segment_idx));
                segment_idx += 1;
                if !full_text.is_empty() {
                    full_text.push(' ');
                }
                full_text.push_str(text);
            }
        }

        let stderr_lines = stderr_thread.join().unwrap_or_default();
        let status = child.wait();
        println!("[STT] whisper exit status: {:?}", status);
        let result = full_text.trim().to_string();

        if result.is_empty() {
            // Emitir las últimas líneas de stderr para diagnosticar
            let error_hint: String = stderr_lines.iter().rev().take(3)
                .cloned().collect::<Vec<_>>().into_iter().rev()
                .collect::<Vec<_>>().join(" | ");
            if !error_hint.is_empty() {
                (self.emit)("process", &format!("whisper stderr: {}", error_hint), None);
            }
        }

        result
    }
}

/// Parsea el progreso de stderr con -pp.
/// Formato: "whisper_print_progress_callback: progress =  10%"
fn parse_progress_line(line: &str) -> Option<u32> {
    if line.contains("progress =") {
        let after_eq = line.split("progress =").nth(1)?;
        let num_str = after_eq.trim().trim_end_matches('%').trim();
        num_str.parse().ok()
    } else {
        None
    }
}

/// Parsea una línea de salida de whisper-cli con -np.
/// Formato: [HH:MM:SS.mmm --> HH:MM:SS.mmm]  texto
fn parse_whisper_segment(line: &str) -> Option<&str> {
    if line.starts_with('[') {
        if let Some(bracket_end) = line.find(']') {
            let text = line[bracket_end + 1..].trim();
            if !text.is_empty() {
                return Some(text);
            }
        }
    }
    None
}

/// Detecta si el texto es un loop de Whisper.
/// Un loop: misma ventana de 5 palabras repetida 5+ veces consecutivas.
fn has_transcription_loop(text: &str) -> bool {
    let words: Vec<&str> = text.split_whitespace().collect();
    let window = 5;
    let threshold = 5;

    if words.len() < window * threshold {
        return false;
    }

    for i in 0..words.len().saturating_sub(window * threshold) {
        let pattern = &words[i..i + window];
        let mut count = 1;
        let mut j = i + window;
        while j + window <= words.len() && &words[j..j + window] == pattern {
            count += 1;
            j += window;
            if count >= threshold {
                return true;
            }
        }
    }
    false
}
