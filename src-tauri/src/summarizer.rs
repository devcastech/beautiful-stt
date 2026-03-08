use std::fs::File;
use std::sync::Arc;

use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaModel, Special};
use llama_cpp_2::sampling::LlamaSampler;

// Mismo tipo que en audio_processor.rs:12
pub type EmitType = Arc<dyn Fn(&str, &str, Option<u32>) + Send + Sync>;

const DEFAULT_LLM_MODEL: &str = "Llama-3.2-3B-Instruct-Q4_K_M.gguf";

// ===================================================
// PASO 2.1: Manejo de modelos (patron de audio_processor.rs:50-71)
// ===================================================

/// Guarda modelos LLM en una subcarpeta separada de Whisper
fn get_model_path(model_name: &str) -> std::path::PathBuf {
    // Mismo patron que audio_processor.rs:50-56, pero con subcarpeta
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default()
        .join("llm_models")
        .join(model_name)
}

/// Descarga el modelo de HuggingFace si no existe localmente
/// Patron identico a audio_processor.rs:58-71
fn ensure_model(
    emit: &dyn Fn(&str, &str, Option<u32>),
    model_name: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let model_path = get_model_path(model_name);

    // Crear directorio si no existe
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
        } else if model_name.contains("Meta-Llama-3.1-8B"){
            "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF"
        } else if model_name.contains("gemma-2-9b-it") {
            "bartowski/gemma-2-9b-it-GGUF"
        } else if model_name.contains("Qwen2.5-14B-Instruct-IQ2_M.gguf") {
            "bartowski/Qwen2.5-14B-Instruct-GGUF"
        } else if model_name.contains("Ministral-8B") {
            "bartowski/Ministral-8B-Instruct-2410-GGUF"
        } else {
            "Qwen2.5-3B-Instruct-GGUF"
        };

        let model_url = format!(
            "https://huggingface.co/{}/resolve/main/{}",
            repo, model_name
        );

        emit(
            "summary_progress",
            &format!("Descargando modelo LLM: {} (esto solo pasa una vez)", model_name),
            None,
        );

        let mut response = ureq::get(&model_url).call()?.into_reader();
        let mut file = File::create(&model_path)?;
        std::io::copy(&mut response, &mut file)?;

        emit("summary_progress", "Modelo descargado", None);
    }

    Ok(())
}

// ===================================================
// PASO 2.2: Prompt templates
// ===================================================

/// Modo "summary": párrafo general de qué trata el audio. Funciona con modelos pequeños.
const SYSTEM_PROMPT: &str = "Eres un asistente que resume transcripciones de audio. \
    Escribe un párrafo breve y claro que explique de qué trata el contenido. \
    Sin secciones, sin viñetas, sin formato especial. Solo texto directo y conciso en español.";

/// Modo "detailed": resumen general + datos clave. Requiere modelos más potentes.
const SYSTEM_PROMPT_DETAILED: &str = "Eres un analista de contenido. \
    Tu misión es resumir una transcripción de audio e identificar sus datos más relevantes: \
    cifras, fechas, nombres y valores clave. \
    Usa solo información explícita del texto. Corrige errores fonéticos de Whisper por contexto. \
    Responde en español.";

/// Limite de caracteres para resumen directo (sin chunking)
const MAX_DIRECT_CHARS: usize = 6000;
/// Tamaño de cada chunk cuando el transcript excede MAX_DIRECT_CHARS
const CHUNK_SIZE: usize = 5000;

// ===================================================
// Prompts modo "summary" (simple, un párrafo)
// ===================================================

/// Prompt directo para transcripciones cortas — solo un párrafo general
fn build_summary_prompt(transcript: &str, model_name: &str) -> String {
    let user = format!(
        "Resume en un párrafo de qué trata este audio:\n\n{}\n\nResumen:",
        transcript
    );
    format_chat_prompt(SYSTEM_PROMPT, &user, "", model_name)
}

/// Extrae las ideas principales de un chunk (para transcripciones largas)
fn build_chunk_extraction_prompt(chunk: &str, chunk_num: usize, total_chunks: usize, model_name: &str) -> String {
    let user = format!(
        "Sección {} de {}. Extrae las ideas principales en 3-5 frases cortas:\n\n{}\n\nIdeas:",
        chunk_num, total_chunks, chunk
    );
    format_chat_prompt(SYSTEM_PROMPT, &user, "", model_name)
}

/// Consolida las ideas de todos los chunks en un párrafo final
fn build_final_summary_prompt(extracted_ideas: &str, model_name: &str) -> String {
    let user = format!(
        "Tienes las ideas principales de cada sección de un audio largo. \
        Escribe UN párrafo que resuma de qué trata el audio completo:\n\n{}\n\nResumen:",
        extracted_ideas
    );
    format_chat_prompt(SYSTEM_PROMPT, &user, "", model_name)
}

// ===================================================
// Prompts modo "detailed" (resumen + datos clave)
// ===================================================

/// Valida que el string sea un objeto JSON mínimamente coherente.
fn is_plausible_json_object(s: &str) -> bool {
    let t = s.trim();
    if !t.starts_with('{') || !t.ends_with('}') {
        return false;
    }
    let opens = t.chars().filter(|&c| c == '{').count();
    let closes = t.chars().filter(|&c| c == '}').count();
    opens == closes && opens >= 1
}

fn entities_block(entities: Option<&str>) -> String {
    match entities {
        Some(json) if is_plausible_json_object(json) => format!(
            "CANDIDATOS DE ENTIDADES (extraídos automáticamente — solo úsalos si coinciden con lo que aparece en el texto; ignora cualquiera que no reconozcas):\n{}\n\n",
            json
        ),
        _ => String::new(),
    }
}

/// Prompt directo para transcripciones cortas — resumen + datos clave
fn build_detailed_prompt(transcript: &str, entities: Option<&str>, model_name: &str) -> String {
    let instructions = format!(
        "{}Analiza esta transcripción y genera:\n\n\
        RESUMEN GENERAL\n\
        (Un párrafo de qué trata el audio.)\n\n\
        DATOS CLAVE\n\
        (Lista de cifras, fechas, nombres, porcentajes y valores mencionados. Omite esta sección si no hay datos concretos.)\n\n\
        TRANSCRIPCIÓN:\n{}",
        entities_block(entities), transcript
    );
    format_chat_prompt(SYSTEM_PROMPT_DETAILED, &instructions, "RESUMEN GENERAL\n", model_name)
}

/// Extrae ideas + datos concretos de un chunk (para transcripciones largas)
fn build_chunk_extraction_detailed_prompt(chunk: &str, chunk_num: usize, total_chunks: usize, model_name: &str) -> String {
    let user = format!(
        "Sección {} de {}. Extrae:\n\
        - Ideas principales (máx. 4 frases)\n\
        - Datos concretos: cifras, fechas, nombres, porcentajes\n\n\
        {}\n\nExtracción:",
        chunk_num, total_chunks, chunk
    );
    format_chat_prompt(SYSTEM_PROMPT_DETAILED, &user, "", model_name)
}

/// Consolida chunks en resumen general + datos clave
fn build_final_detailed_prompt(extracted_ideas: &str, entities: Option<&str>, model_name: &str) -> String {
    let instructions = format!(
        "{}Con la información extraída de todas las secciones, genera:\n\n\
        RESUMEN GENERAL\n\
        (Un párrafo de qué trata el audio.)\n\n\
        DATOS CLAVE\n\
        (Lista de cifras, fechas, nombres, porcentajes y valores. Omite si no hay datos concretos.)\n\n\
        INFORMACIÓN EXTRAÍDA:\n{}",
        entities_block(entities), extracted_ideas
    );
    format_chat_prompt(SYSTEM_PROMPT_DETAILED, &instructions, "RESUMEN GENERAL\n", model_name)
}

/// Formatea el prompt segun el template del modelo (Phi, Llama, Qwen, Gemma, Mistral)
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
        // Gemma 2 no tiene system turn, se concatena system+user en el turno user
        format!(
            "<start_of_turn>user\n{}\n\n{}<end_of_turn>\n\
            <start_of_turn>model\n{}",
            system, user, assistant_prefix
        )
    } else if model_lower.contains("ministral") {
        // Mistral instruct format: <s>[INST]{system}\n\n{user}[/INST]
        format!(
            "<s>[INST]{}\n\n{}[/INST]{}",
            system, user, assistant_prefix
        )
    } else {
        format!(
            "<|im_start|>system\n{}<|im_end|>\n\
            <|im_start|>user\n{}<|im_end|>\n\
            <|im_start|>assistant\n{}",
            system, user, assistant_prefix
        )
    }
}

// ===================================================
// Extracción de entidades con Gemma (solo modo "detailed")
// ===================================================

const GEMMA_ENTITY_MODEL: &str = "gemma-2-9b-it-IQ4_XS.gguf";

fn build_entity_extraction_prompt(text: &str) -> String {
    let schema = r#"{"personas":[],"organizaciones":[],"fechas":[],"lugares":[],"cifras":[{"valor":"","contexto":""}],"normas":[],"votaciones":[{"tema":"","resultado":""}]}"#;

    let user = format!(
        "Extrae todos los datos estructurados presentes en el siguiente texto.\n\
        Responde ÚNICAMENTE con un objeto JSON minificado y válido, sin explicaciones ni markdown.\n\
        Esquema (incluye solo los campos que tengan datos):\n{}\n\n\
        TEXTO:\n{}",
        schema, text
    );

    // Gemma no tiene turn de sistema; el { final guía la salida JSON directamente
    format!(
        "<start_of_turn>user\n{}<end_of_turn>\n<start_of_turn>model\n{{",
        user
    )
}

/// Carga Gemma y extrae entidades estructuradas del texto en JSON.
fn extract_entities_with_gemma(
    emit: &dyn Fn(&str, &str, Option<u32>),
    backend: &LlamaBackend,
    text: &str,
) -> Result<String, String> {
    emit("summary_progress", "Extrayendo entidades con Gemma...", None);

    if let Err(e) = ensure_model(emit, GEMMA_ENTITY_MODEL) {
        return Err(format!("Error descargando Gemma: {}", e));
    }

    let model_path = get_model_path(GEMMA_ENTITY_MODEL);
    let model_params = LlamaModelParams::default().with_n_gpu_layers(99);
    let model = LlamaModel::load_from_file(backend, model_path, &model_params)
        .map_err(|e| format!("Error cargando Gemma: {}", e))?;

    let prompt = build_entity_extraction_prompt(text);
    // El prompt termina en `{` — run_inference genera lo que sigue;
    // reincorporamos el `{` para tener JSON válido.
    let raw = run_inference(&model, backend, &prompt, 700, emit, false)?;
    let json = format!("{{{}", raw);

    println!("\n╔══════════════════════════════════╗");
    println!("║      GEMMA ENTITY EXTRACTION     ║");
    println!("╠══════════════════════════════════╣");
    println!("{}", json);
    println!("╚══════════════════════════════════╝\n");

    if !is_plausible_json_object(&json) {
        println!("[GEMMA] Salida descartada: no es JSON válido\n{}", json);
        emit("summary_progress", "Gemma: salida descartada (no es JSON válido), continuando sin contexto", None);
        return Err("Salida no es JSON válido".to_string());
    }

    Ok(json)
}

// ===================================================
// PASO 2.3: Funcion principal de resumen
// ===================================================

/// Ejecuta inferencia sobre un prompt y retorna el texto generado.
/// Si `stream_to_frontend` es true, emite cada token via "summary_segment".
fn run_inference(
    model: &LlamaModel,
    backend: &LlamaBackend,
    prompt: &str,
    max_tokens: i32,
    emit: &dyn Fn(&str, &str, Option<u32>),
    stream_to_frontend: bool,
) -> Result<String, String> {
    let ctx_params = LlamaContextParams::default()
        .with_n_ctx(std::num::NonZeroU32::new(8192))
        .with_n_batch(512);

    let mut ctx = model
        .new_context(backend, ctx_params)
        .map_err(|e| format!("Error creando contexto: {}", e))?;

    let tokens = model
        .str_to_token(prompt, AddBos::Always)
        .map_err(|e| format!("Error tokenizando: {}", e))?;

    // Evaluar tokens del prompt (batch processing)
    let mut batch = LlamaBatch::new(512, 1);
    let batch_size = 512;

    for chunk_start in (0..tokens.len()).step_by(batch_size) {
        let chunk_end = std::cmp::min(chunk_start + batch_size, tokens.len());
        batch.clear();

        for i in chunk_start..chunk_end {
            let is_last = i == tokens.len() - 1;
            batch
                .add(tokens[i], i as i32, &[0], is_last)
                .map_err(|e| format!("Error en batch: {}", e))?;
        }

        ctx.decode(&mut batch)
            .map_err(|e| format!("Error decodificando prompt: {}", e))?;
    }

    // Generacion autoregresiva
    let mut output = String::new();
    let mut n_cur = tokens.len() as i32;

    let mut sampler = LlamaSampler::chain_simple([
        LlamaSampler::penalties(64, 1.1, 0.0, 0.0),
        LlamaSampler::temp(0.3),
        LlamaSampler::dist(42),
    ]);

    // Buffer para acumular bytes de tokens que pueden ser UTF-8 parcial
    let mut byte_buf: Vec<u8> = Vec::new();

    for i in 0..max_tokens {
        let new_token = sampler.sample(&ctx, batch.n_tokens() - 1);

        if model.is_eog_token(new_token) {
            break;
        }

        let token_bytes = model
            .token_to_bytes(new_token, Special::Tokenize)
            .map_err(|e| format!("Error decodificando token: {}", e))?;

        byte_buf.extend_from_slice(&token_bytes);

        // Intentar convertir el buffer acumulado a UTF-8
        match std::str::from_utf8(&byte_buf) {
            Ok(valid_str) => {
                output.push_str(valid_str);

                if stream_to_frontend {
                    emit("summary_segment", valid_str, None);
                    if i % 10 == 0 {
                        let progress = ((i as f32 / max_tokens as f32) * 100.0) as u32;
                        emit("summary_progress", "Generando resumen", Some(progress));
                    }
                }

                byte_buf.clear();
            }
            Err(_) => {
                // UTF-8 incompleto, seguir acumulando bytes del siguiente token
            }
        }

        batch.clear();
        batch
            .add(new_token, n_cur, &[0], true)
            .map_err(|e| format!("Error en batch: {}", e))?;

        ctx.decode(&mut batch)
            .map_err(|e| format!("Error decodificando: {}", e))?;

        n_cur += 1;
    }

    Ok(output.trim().to_string())
}

/// Divide el texto en chunks de aproximadamente `chunk_size` caracteres,
/// cortando en el ultimo espacio para no partir palabras.
fn split_into_chunks(text: &str, chunk_size: usize) -> Vec<&str> {
    let mut chunks = Vec::new();
    let mut start = 0;

    while start < text.len() {
        let end = std::cmp::min(start + chunk_size, text.len());
        // Si no estamos al final, buscar el ultimo espacio para no cortar palabras
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

pub fn summarize_transcript(
    emit: EmitType,
    transcript: &str,
    llm_model: Option<&str>,
    output_mode: Option<&str>,
) -> Result<String, String> {
    let model_name = llm_model.unwrap_or(DEFAULT_LLM_MODEL);
    let mode_str = output_mode.unwrap_or("summary");
    let is_detailed = mode_str == "detailed";

    let mode_label = if is_detailed { "resumen detallado" } else { "resumen" };

    println!("\n[SUMMARIZER] output_mode={:?}, is_detailed={}, model={}", mode_str, is_detailed, model_name);

    // 1. Descargar modelo principal si no existe
    emit("summary_progress", &format!("Preparando modelo {}", model_name), None);
    if let Err(e) = ensure_model(&*emit, model_name) {
        return Err(format!("Error descargando modelo: {}", e));
    }

    // 2. Inicializar backend LLM
    emit("summary_progress", "Inicializando LLM", None);
    let backend = LlamaBackend::init().map_err(|e| format!("Backend error: {}", e))?;

    // 3. Gemma extrae entidades — SOLO en modo "detailed"
    let entities: Option<String> = if is_detailed {
        let gemma_path = get_model_path(GEMMA_ENTITY_MODEL);
        println!("[GEMMA] Model path: {:?}", gemma_path);
        println!("[GEMMA] File exists: {}", gemma_path.exists());
        if gemma_path.exists() {
            if let Ok(meta) = std::fs::metadata(&gemma_path) {
                println!("[GEMMA] File size: {} bytes ({:.1} GB)", meta.len(), meta.len() as f64 / 1_073_741_824.0);
            }
        }

        emit("summary_progress", "Extrayendo datos clave con Gemma...", None);
        let src: String = transcript.chars().take(5000).collect();
        println!("[GEMMA] Starting entity extraction with {} chars of text", src.len());

        match extract_entities_with_gemma(&*emit, &backend, &src) {
            Ok(json) => {
                println!("[GEMMA] SUCCESS — entities extracted");
                emit("summary_progress", "Datos extraídos — iniciando análisis principal", None);
                Some(json)
            }
            Err(e) => {
                println!("\n[GEMMA ERROR] ============================================");
                println!("[GEMMA ERROR] {}", e);
                println!("[GEMMA ERROR] ============================================\n");
                emit("summary_progress", &format!("Gemma no disponible ({}), continuando sin contexto", e), None);
                None
            }
        }
    } else {
        println!("[GEMMA] Skipped — not in detailed mode");
        None
    }; // Gemma liberada aquí

    let model_path = get_model_path(model_name);
    let model_params = LlamaModelParams::default().with_n_gpu_layers(99);

    // 4. Main LLM genera el resumen
    emit("summary_progress", "Cargando modelo LLM", None);
    let model = LlamaModel::load_from_file(&backend, model_path, &model_params)
        .map_err(|e| format!("Error cargando modelo: {}", e))?;

    let summary = if transcript.len() <= MAX_DIRECT_CHARS {
        // --- Directo (transcript corto) ---
        let prompt = if is_detailed {
            build_detailed_prompt(transcript, entities.as_deref(), model_name)
        } else {
            build_summary_prompt(transcript, model_name)
        };
        emit("summary_progress", &format!("Generando {}", mode_label), Some(0));
        let max_tokens = if is_detailed { 450 } else { 250 };
        run_inference(&model, &backend, &prompt, max_tokens, &*emit, true)?
    } else {
        // --- Chunked ---
        let chunks = split_into_chunks(transcript, CHUNK_SIZE);
        let total_chunks = chunks.len();
        let mut all_ideas = String::new();

        emit(
            "summary_progress",
            &format!("Transcript largo ({} caracteres). Procesando en {} secciones...", transcript.len(), total_chunks),
            Some(0),
        );

        for (idx, chunk) in chunks.iter().enumerate() {
            let chunk_num = idx + 1;
            emit(
                "summary_progress",
                &format!("Extrayendo información: sección {}/{}", chunk_num, total_chunks),
                Some(((idx as f32 / total_chunks as f32) * 70.0) as u32),
            );

            let extraction_prompt = if is_detailed {
                build_chunk_extraction_detailed_prompt(chunk, chunk_num, total_chunks, model_name)
            } else {
                build_chunk_extraction_prompt(chunk, chunk_num, total_chunks, model_name)
            };

            let chunk_tokens = if is_detailed { 300 } else { 150 };
            let ideas = run_inference(&model, &backend, &extraction_prompt, chunk_tokens, &*emit, false)?;

            all_ideas.push_str(&format!("\n### Sección {}\n{}\n", chunk_num, ideas));
        }

        // Pase final: consolida ideas
        emit("summary_progress", &format!("Generando {} final consolidado...", mode_label), Some(75));
        let final_prompt = if is_detailed {
            build_final_detailed_prompt(&all_ideas, entities.as_deref(), model_name)
        } else {
            build_final_summary_prompt(&all_ideas, model_name)
        };
        let final_tokens = if is_detailed { 500 } else { 250 };
        run_inference(&model, &backend, &final_prompt, final_tokens, &*emit, true)?
    };

    emit("summary_progress", "Completado", Some(100));
    Ok(summary)
}
