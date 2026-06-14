use std::io::Read;
use std::process::Stdio;
use std::sync::Arc;

pub type EmitType = Arc<dyn Fn(&str, &str, Option<u32>) + Send + Sync>;

const LLAMA_VERSION: &str = "b9496";
const DEFAULT_LLM_MODEL: &str = "Llama-3.2-3B-Instruct-Q4_K_M.gguf";
const MAX_DIRECT_CHARS: usize = 6000;
const CHUNK_SIZE: usize = 5000;

const SYSTEM_PROMPT: &str = "Eres un experto en resumir transcripciones de audio en español. \
    Captura el tema central, los puntos más importantes, y cualquier dato relevante \
    como nombres propios, cifras, fechas o lugares. \
    Escribe en español claro y natural, en prosa continua. \
    Sin encabezados, sin viñetas, sin listas, sin markdown. Solo párrafos de texto. \
    Corrige implícitamente errores fonéticos de Whisper usando el contexto del texto.";

// ─── Binary management ────────────────────────────────────────────────────────

fn llama_cli_archive_url() -> &'static str {
    if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        "https://github.com/ggml-org/llama.cpp/releases/download/b9496/llama-b9496-bin-macos-arm64.tar.gz"
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        "https://github.com/ggml-org/llama.cpp/releases/download/b9496/llama-b9496-bin-macos-x64.tar.gz"
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        "https://github.com/ggml-org/llama.cpp/releases/download/b9496/llama-b9496-bin-ubuntu-x64.tar.gz"
    } else if cfg!(all(target_os = "linux", target_arch = "aarch64")) {
        "https://github.com/ggml-org/llama.cpp/releases/download/b9496/llama-b9496-bin-ubuntu-arm64.tar.gz"
    } else if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        "https://github.com/ggml-org/llama.cpp/releases/download/b9496/llama-b9496-bin-win-cpu-x64.zip"
    } else {
        ""
    }
}

// macOS/Linux: streaming tar.gz extraction, strips one leading path component
#[cfg(not(target_os = "windows"))]
fn extract_tar_gz(
    reader: impl Read,
    dest_dir: &std::path::Path,
) -> Result<(), Box<dyn std::error::Error>> {
    use flate2::read::GzDecoder;
    use tar::Archive;

    let gz = GzDecoder::new(reader);
    let mut archive = Archive::new(gz);

    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = entry.path()?.into_owned();
        // Strip "llama-b9496/" prefix
        let stripped: std::path::PathBuf = path.components().skip(1).collect();
        if stripped.as_os_str().is_empty() {
            continue;
        }
        let dest = dest_dir.join(&stripped);
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)?;
        }
        entry.unpack(&dest)?;
    }
    Ok(())
}

// Windows: zip extraction (must buffer — ZipArchive requires Seek)
#[cfg(target_os = "windows")]
fn extract_zip(
    reader: impl Read,
    dest_dir: &std::path::Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut data = Vec::new();
    let mut r = reader;
    r.read_to_end(&mut data)?;
    let cursor = std::io::Cursor::new(data);
    let mut archive = zip::ZipArchive::new(cursor)?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        if file.is_dir() {
            continue;
        }
        let name = file.enclosed_name().ok_or("Invalid zip entry")?.to_owned();
        let dest = dest_dir.join(&name);
        let mut outfile = std::fs::File::create(&dest)?;
        std::io::copy(&mut file, &mut outfile)?;
    }
    Ok(())
}

fn ensure_llama_bin(
    emit: &dyn Fn(&str, &str, Option<u32>),
) -> Result<std::path::PathBuf, Box<dyn std::error::Error>> {
    // llama-completion is available on all platforms in b9496+: non-interactive, stdout-clean.
    let bin_name = if cfg!(target_os = "windows") {
        "llama-completion.exe"
    } else {
        "llama-completion"
    };
    let bin_dir = crate::utils::models_base_dir().join("bin");
    let stored_path = bin_dir.join(bin_name);

    // Dev: prefer system binary — it has the right library paths for the dev environment
    #[cfg(debug_assertions)]
    {
        #[cfg(target_os = "macos")]
        for prefix in &["/opt/homebrew/bin", "/usr/local/bin"] {
            let p = std::path::PathBuf::from(prefix).join(bin_name);
            if p.exists() {
                return Ok(p);
            }
        }
        #[cfg(target_os = "linux")]
        for prefix in &["/usr/local/bin", "/usr/bin"] {
            let p = std::path::PathBuf::from(prefix).join(bin_name);
            if p.exists() {
                return Ok(p);
            }
        }
    }

    if stored_path.exists() {
        return Ok(stored_path);
    }

    let url = llama_cli_archive_url();
    if url.is_empty() {
        return Err("Plataforma no soportada para descarga automática de llama-completion".into());
    }

    std::fs::create_dir_all(&bin_dir)?;
    emit(
        "summary_progress",
        &format!("Descargando llama.cpp {} (solo una vez, ~15MB)...", LLAMA_VERSION),
        None,
    );

    let response = ureq::get(url).call()?.into_reader();

    #[cfg(not(target_os = "windows"))]
    extract_tar_gz(response, &bin_dir)?;

    #[cfg(target_os = "windows")]
    extract_zip(response, &bin_dir)?;

    // Ensure the binary is executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&stored_path, std::fs::Permissions::from_mode(0o755))?;
    }

    emit("summary_progress", "llama-completion listo", None);
    Ok(stored_path)
}

// ─── Model management ─────────────────────────────────────────────────────────

fn get_model_path(model_name: &str) -> std::path::PathBuf {
    crate::utils::models_base_dir()
        .join("llm_models")
        .join(model_name)
}

fn ensure_model(
    emit: &dyn Fn(&str, &str, Option<u32>),
    model_name: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let model_path = get_model_path(model_name);
    if let Some(parent) = model_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    if !model_path.exists() {
        let repo = if model_name.contains("phi-4") {
            "microsoft/phi-4-gguf"
        } else if model_name.contains("Phi") {
            "bartowski/Phi-3.5-mini-instruct-GGUF"
        } else if model_name.contains("Llama-3.2-3B") {
            "bartowski/Llama-3.2-3B-Instruct-GGUF"
        } else if model_name.contains("Meta-Llama-3.1-8B") {
            "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF"
        } else if model_name.contains("gemma-2-9b-it") {
            "bartowski/gemma-2-9b-it-GGUF"
        } else if model_name.contains("google_gemma-4-E2B-it") {
            "bartowski/google_gemma-4-E2B-it-GGUF"
        } else if model_name.contains("Qwen2.5-14B") {
            "bartowski/Qwen2.5-14B-Instruct-GGUF"
        } else if model_name.contains("Qwen_Qwen3.5-4B") {
            "bartowski/Qwen_Qwen3.5-4B-GGUF"
        } else if model_name.contains("Ministral-8B") {
            "bartowski/Ministral-8B-Instruct-2410-GGUF"
        } else {
            "Qwen/Qwen2.5-3B-Instruct-GGUF"
        };

        let model_url = format!(
            "https://huggingface.co/{}/resolve/main/{}",
            repo, model_name
        );
        let response = ureq::get(&model_url).call()?;
        let total_bytes = response
            .header("Content-Length")
            .and_then(|v| v.parse::<u64>().ok());

        emit(
            "summary_progress",
            &format!(
                "Descargando modelo{}...",
                total_bytes
                    .map(|b| format!(" ({:.1} GB)", b as f64 / 1_073_741_824.0))
                    .unwrap_or_default()
            ),
            Some(0),
        );

        let mut reader = response.into_reader();
        let mut file = std::fs::File::create(&model_path)
            .map_err(|e| format!("No se pudo crear archivo: {}", e))?;

        let mut buf = vec![0u8; 512 * 1024]; // 512KB chunks
        let mut downloaded: u64 = 0;
        let mut last_pct = 0u32;

        let result = (|| -> Result<(), Box<dyn std::error::Error>> {
            loop {
                let n = reader.read(&mut buf)?;
                if n == 0 {
                    break;
                }
                std::io::Write::write_all(&mut file, &buf[..n])?;
                downloaded += n as u64;

                if let Some(total) = total_bytes {
                    let pct = ((downloaded as f64 / total as f64) * 100.0) as u32;
                    if pct != last_pct {
                        emit(
                            "summary_progress",
                            &format!(
                                "Descargando modelo... {:.0}/{:.0} MB",
                                downloaded as f64 / 1_048_576.0,
                                total as f64 / 1_048_576.0
                            ),
                            Some(pct),
                        );
                        last_pct = pct;
                    }
                }
            }
            Ok(())
        })();

        if let Err(e) = result {
            let _ = std::fs::remove_file(&model_path);
            return Err(format!("Descarga interrumpida: {}", e).into());
        }

        emit("summary_progress", "Modelo descargado", Some(100));
    }
    Ok(())
}

// ─── Inference ────────────────────────────────────────────────────────────────

fn run_llama_cli(
    emit: &dyn Fn(&str, &str, Option<u32>),
    bin_path: &std::path::Path,
    model_path: &std::path::Path,
    prompt: &str,
    max_tokens: u32,
    stream: bool,
) -> Result<String, String> {
    let prompt_file = std::env::temp_dir()
        .join(format!("beautiful_stt_llm_{}.txt", std::process::id()));
    std::fs::write(&prompt_file, prompt.as_bytes())
        .map_err(|e| format!("Error escribiendo prompt: {}", e))?;

    let mut child = std::process::Command::new(bin_path)
        .arg("-m").arg(model_path)
        .arg("-f").arg(&prompt_file)
        .arg("-n").arg(max_tokens.to_string())
        .arg("-ngl").arg("99")
        .arg("-c").arg("8192")
        .arg("--temp").arg("0.3")
        .arg("--repeat-penalty").arg("1.1")
        .arg("--seed").arg("42")
        .arg("-no-cnv")            // disable conversation/interactive mode (llama-completion b9496+)
        .arg("--no-display-prompt")
        // --log-disable suppresses stdout in b9496 — omit it; stderr is already nulled below
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Error ejecutando llama-cli ({:?}): {}", bin_path, e))?;

    let mut stdout = child.stdout.take().expect("Failed to get stdout");
    let mut output = String::new();
    let mut byte_buf: Vec<u8> = Vec::new();
    let mut read_buf = [0u8; 256];
    let mut read_count: u32 = 0;

    loop {
        match stdout.read(&mut read_buf) {
            Ok(0) => break,
            Ok(n) => {
                byte_buf.extend_from_slice(&read_buf[..n]);
                match std::str::from_utf8(&byte_buf) {
                    Ok(s) => {
                        if !s.is_empty() {
                            output.push_str(s);
                            if stream {
                                emit("summary_segment", s, None);
                                read_count += 1;
                                if read_count % 8 == 0 {
                                    let progress = ((output.len() as f32
                                        / (max_tokens as f32 * 3.5))
                                        .min(0.95)
                                        * 100.0) as u32;
                                    emit("summary_progress", "Generando resumen", Some(progress));
                                }
                            }
                        }
                        byte_buf.clear();
                    }
                    Err(e) => {
                        let valid_up_to = e.valid_up_to();
                        if valid_up_to > 0 {
                            let s = std::str::from_utf8(&byte_buf[..valid_up_to]).unwrap();
                            output.push_str(s);
                            if stream {
                                emit("summary_segment", s, None);
                            }
                            byte_buf.drain(..valid_up_to);
                        }
                        // Remaining bytes form an incomplete multi-byte char; wait for next read
                    }
                }
            }
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = std::fs::remove_file(&prompt_file);
                return Err(format!("Error leyendo salida de llama-cli: {}", e));
            }
        }
    }

    let _ = child.wait();
    let _ = std::fs::remove_file(&prompt_file);

    // return an error so the caller knows to retry with more tokens.
    let after_think = if let Some(end) = output.find("</think>") {
        &output[end + "</think>".len()..]
    } else if output.contains("<think>") {
        return Err("El modelo agotó los tokens durante el razonamiento. Usa /no_think o aumenta el límite de tokens.".into());
    } else {
        &output
    };

    let cleaned = after_think
        .trim()
        .trim_end_matches("[end of text]")
        .trim_end_matches("<|eot_id|>")
        .trim_end_matches("<|im_end|>")
        .trim_end_matches("<end_of_turn>")
        .trim_end_matches("<|end|>")
        .trim()
        .to_string();
    Ok(cleaned)
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

fn format_chat_prompt(system: &str, user: &str, assistant_prefix: &str, model_name: &str) -> String {
    let model_lower = model_name.to_lowercase();
    if model_lower.contains("phi") {
        format!(
            "<|system|>\n{}<|end|>\n\
            <|user|>\n{}<|end|>\n\
            <|assistant|>\n{}",
            system, user, assistant_prefix
        )
    } else if model_lower.contains("llama") {
        format!(
            "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n\
            {}<|eot_id|>\n\
            <|start_header_id|>user<|end_header_id|>\n\n\
            {}<|eot_id|>\n\
            <|start_header_id|>assistant<|end_header_id|>\n\n{}",
            system, user, assistant_prefix
        )
    } else if model_lower.contains("gemma") {
        format!(
            "<start_of_turn>user\n{}\n\n{}<end_of_turn>\n\
            <start_of_turn>model\n{}",
            system, user, assistant_prefix
        )
    } else if model_lower.contains("ministral") {
        format!("<s>[INST]{}\n\n{}[/INST]{}", system, user, assistant_prefix)
    } else {
        // ChatML (Qwen, etc.)
        // For Qwen3+ thinking models, pre-fill an empty <think> block so the model
        // skips reasoning and goes straight to the answer.
        let prefix = if model_lower.contains("qwen3") || model_lower.contains("qwen_qwen3") {
            format!("<think>\n\n</think>\n{}", assistant_prefix)
        } else {
            assistant_prefix.to_string()
        };
        format!(
            "<|im_start|>system\n{}<|im_end|>\n\
            <|im_start|>user\n{}<|im_end|>\n\
            <|im_start|>assistant\n{}",
            system, user, prefix
        )
    }
}

fn build_summary_prompt(transcript: &str, model_name: &str) -> String {
    let user = format!(
        "Transcripción:\n{}\n\nEscribe un resumen claro y completo. \
        Cubre el tema principal y todos los puntos importantes mencionados. \
        Usa tantas oraciones como sea necesario para no omitir información relevante. Resumen:",
        transcript
    );
    format_chat_prompt(SYSTEM_PROMPT, &user, "", model_name)
}

fn build_chunk_extraction_prompt(chunk: &str, chunk_num: usize, total: usize, model_name: &str) -> String {
    let user = format!(
        "Sección {} de {}. Extrae los puntos más importantes: ideas, \
        personas, cifras, fechas y eventos relevantes.\n\n{}\n\nPuntos clave:",
        chunk_num, total, chunk
    );
    format_chat_prompt(SYSTEM_PROMPT, &user, "", model_name)
}

fn build_final_summary_prompt(ideas: &str, model_name: &str) -> String {
    let user = format!(
        "Usando los puntos clave de cada sección, escribe un resumen cohesivo \
        en 2-4 oraciones del audio completo:\n\n{}\n\nResumen:",
        ideas
    );
    format_chat_prompt(SYSTEM_PROMPT, &user, "", model_name)
}

// ─── Chunking ────────────────────────────────────────────────────────────────

fn split_into_chunks(text: &str, chunk_size: usize) -> Vec<&str> {
    let mut chunks = Vec::new();
    let mut start = 0;
    while start < text.len() {
        let end = std::cmp::min(start + chunk_size, text.len());
        let end = if end < text.len() {
            text[start..end].rfind(' ').map(|i| start + i).unwrap_or(end)
        } else {
            end
        };
        chunks.push(text[start..end].trim());
        start = end;
    }
    chunks.into_iter().filter(|c| !c.is_empty()).collect()
}

// ─── Entry point ─────────────────────────────────────────────────────────────

pub fn summarize_transcript(
    emit: EmitType,
    transcript: &str,
    llm_model: Option<&str>,
    _output_mode: Option<&str>,
) -> Result<String, String> {
    let model_name = llm_model.unwrap_or(DEFAULT_LLM_MODEL);

    emit("summary_progress", &format!("Preparando modelo {}", model_name), None);
    if let Err(e) = ensure_model(&*emit, model_name) {
        return Err(format!("Error descargando modelo: {}", e));
    }

    emit("summary_progress", "Verificando llama-completion", None);
    let bin_path = ensure_llama_bin(&*emit)
        .map_err(|e| format!("Error preparando llama-completion: {}", e))?;
    let model_path = get_model_path(model_name);

    let summary = if transcript.len() <= MAX_DIRECT_CHARS {
        let prompt = build_summary_prompt(transcript, model_name);
        emit("summary_progress", "Generando resumen", Some(0));
        run_llama_cli(&*emit, &bin_path, &model_path, &prompt, 550, true)?
    } else {
        let chunks = split_into_chunks(transcript, CHUNK_SIZE);
        let total = chunks.len();
        let mut all_ideas = String::new();

        emit(
            "summary_progress",
            &format!("Procesando {} secciones...", total),
            Some(0),
        );

        for (idx, chunk) in chunks.iter().enumerate() {
            let chunk_num = idx + 1;
            emit(
                "summary_progress",
                &format!("Extrayendo información: sección {}/{}", chunk_num, total),
                Some(((idx as f32 / total as f32) * 70.0) as u32),
            );
            let extraction_prompt = build_chunk_extraction_prompt(chunk, chunk_num, total, model_name);
            let ideas = run_llama_cli(
                &*emit,
                &bin_path,
                &model_path,
                &extraction_prompt,
                180,
                false,
            )?;
            all_ideas.push_str(&format!("\n### Sección {}\n{}\n", chunk_num, ideas));
        }

        emit("summary_progress", "Generando resumen final...", Some(75));
        let final_prompt = build_final_summary_prompt(&all_ideas, model_name);
        run_llama_cli(&*emit, &bin_path, &model_path, &final_prompt, 550, true)?
    };

    emit("summary_progress", "Completado", Some(100));
    Ok(summary)
}
