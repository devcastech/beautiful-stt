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
// PASO 2.2: Prompt template
// ===================================================

const SYSTEM_PROMPT: &str = "Eres un Analista de Inteligencia Operativa. \
    Tu misión es convertir transcripciones desordenadas en manuales de consulta rápida.\n\
    Reglas estrictas:\n\
    - SOLO usa información explícita del texto\n\
    - PROHIBICIÓN NARRATIVA: No uses \"El orador dice\", \"Se explica que\" o similares. Solo viñetas directas\n\
    - CORRECCIÓN CONTEXTUAL: Si detectas palabras mal transcritas (errores de fonética de Whisper), sustitúyelas por la palabra correcta según contexto\n\
    - Usa verbos de acción: \"Realizar\", \"Evitar\", \"Calcular\"\n\
    - Un dato por cada viñeta (atomicidad)\n\
    - Marca datos inciertos con [?]\n\
    - Responde en español";

/// Limite de caracteres para resumen directo (sin chunking)
const MAX_DIRECT_CHARS: usize = 6000;
/// Tamaño de cada chunk cuando el transcript excede MAX_DIRECT_CHARS
const CHUNK_SIZE: usize = 5000;

/// Prompt para extraer ideas clave de un chunk individual
fn build_chunk_extraction_prompt(chunk: &str, chunk_num: usize, total_chunks: usize, model_name: &str) -> String {
    let instructions = format!(
        "Estás procesando la sección {} de {} de una transcripción larga.\n\n\
        ### REGLAS DE ORO:\n\
        1. PROHIBICIÓN NARRATIVA: No uses \"El orador dice\", \"Se explica que\" o similares. Solo viñetas directas.\n\
        2. CORRECCIÓN CONTEXTUAL: Si detectas palabras mal transcritas (errores fonéticos de Whisper), sustitúyelas por la palabra correcta según contexto.\n\
        3. ACCIÓN SOBRE DESCRIPCIÓN: Prioriza verbos de acción (\"Realizar\", \"Evitar\", \"Calcular\").\n\
        4. ATOMICIDAD: Un dato por cada viñeta.\n\n\
        ### FRAGMENTO:\n{}\n\n\
        ### EXTRACCIÓN:\n\
        Genera una lista de bullet points atómicos con: instrucciones, datos, alertas y términos clave. Nada más.",
        chunk_num, total_chunks, chunk
    );

    let system = "Eres un Analista de Inteligencia Operativa. \
        Extraes información atómica de fragmentos de transcripciones de audio.\n\
        Reglas: SOLO información explícita, corrige errores de transcripción por contexto, sin narrar, sin relleno. Responde en español.";

    format_chat_prompt(system, &instructions, "- ", model_name)
}

/// Prompt final que recibe todas las ideas extraídas de los chunks
fn build_final_summary_prompt(extracted_ideas: &str, model_name: &str) -> String {
    let instructions = format!(
        "A continuación tienes las ideas clave extraídas de una transcripción larga, procesada por secciones.\n\
        Usa TODA esta información para generar un manual de consulta rápida.\n\n\
        ### REGLAS DE ORO DE SALIDA:\n\
        1. PROHIBICIÓN NARRATIVA: No uses \"El orador dice\", \"Se explica que\" o similares. Solo viñetas directas.\n\
        2. CORRECCIÓN CONTEXTUAL: Si detectas palabras mal transcritas (errores fonéticos de Whisper), sustitúyelas por la palabra correcta según contexto (ej: \"quino\" -> \"quimio\", \"máscara\" -> \"cáscara\").\n\
        3. ACCIÓN SOBRE DESCRIPCIÓN: Prioriza verbos de acción (\"Realizar\", \"Evitar\", \"Calcular\").\n\
        4. ATOMICIDAD: Un dato por cada viñeta.\n\
        5. OMISIÓN INTELIGENTE: Si no hay suficiente información para una sección, omítela por completo. Si ninguna sección aplica, genera solo un resumen general del contenido.\n\n\
        ### IDEAS CLAVE EXTRAÍDAS:\n{}\n\n\
        ### ESTRUCTURA DEL REPORTE:\n\
        Genera este formato sin preámbulos (omite secciones sin información suficiente):\n\n\
        1. Propósito y Contexto\n\
        (Define en una frase corta qué se está tratando en este audio).\n\n\
        2. Instrucciones y Procedimientos (Checklist)\n\
        (Lista de pasos a seguir, reglas o protocolos detectados en el audio).\n\n\
        3. Datos, Cifras y Entidades\n\
        (Extrae números, fechas, nombres propios, marcas, dosis o fórmulas matemáticas).\n\n\
        4. Alertas y Restricciones\n\
        (Cualquier advertencia, \"lo que NO se debe hacer\" o signos de peligro mencionados).\n\n\
        Si ninguna sección aplica, genera solo:\n\
        Resumen General\n\
        (Resumen directo del contenido en viñetas).\n\n\
        Genera SOLO el reporte.",
        extracted_ideas
    );

    let system = SYSTEM_PROMPT;

    format_chat_prompt(system, &instructions, "## 1. Propósito y Contexto\n", model_name)
}

/// Prompt directo para transcripciones cortas
fn build_summary_prompt(transcript: &str, model_name: &str) -> String {
    let instructions = format!(
        "### REGLAS DE ORO DE SALIDA:\n\
        1. PROHIBICIÓN NARRATIVA: No uses \"El orador dice\", \"Se explica que\" o similares. Solo viñetas directas.\n\
        2. CORRECCIÓN CONTEXTUAL: Si detectas palabras mal transcritas (errores fonéticos de Whisper), sustitúyelas por la palabra correcta según contexto (ej: \"quino\" -> \"quimio\", \"máscara\" -> \"cáscara\").\n\
        3. ACCIÓN SOBRE DESCRIPCIÓN: Prioriza verbos de acción (\"Realizar\", \"Evitar\", \"Calcular\").\n\
        4. ATOMICIDAD: Un dato por cada viñeta.\n\
        5. OMISIÓN INTELIGENTE: Si no hay suficiente información para una sección, omítela por completo. Si ninguna sección aplica, genera solo un resumen general del contenido.\n\n\
        ### TRANSCRIPCIÓN A PROCESAR:\n{}\n\n\
        ### ESTRUCTURA DEL REPORTE:\n\
        Genera este formato sin preámbulos (omite secciones sin información suficiente):\n\n\
        1. Propósito y Contexto\n\
        (Define en una frase corta qué se está tratando en este audio).\n\n\
        2. Instrucciones y Procedimientos (Checklist)\n\
        (Lista de pasos a seguir, reglas o protocolos detectados en el audio).\n\n\
        3. Datos, Cifras y Entidades\n\
        (Extrae números, fechas, nombres propios, marcas, dosis o fórmulas matemáticas).\n\n\
        4. Alertas y Restricciones\n\
        (Cualquier advertencia, \"lo que NO se debe hacer\" o signos de peligro mencionados).\n\n\
        Si ninguna sección aplica, genera solo:\n\
        Resumen General\n\
        (Resumen directo del contenido en viñetas).\n\n\
        Genera SOLO el reporte.",
        transcript
    );

    let system = SYSTEM_PROMPT;

    format_chat_prompt(system, &instructions, "## 1. Propósito y Contexto\n", model_name)
}

/// Formatea el prompt segun el template del modelo (Phi, Llama, Qwen)
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
        .with_n_ctx(std::num::NonZeroU32::new(4096))
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

    for i in 0..max_tokens {
        let new_token = sampler.sample(&ctx, batch.n_tokens() - 1);

        if model.is_eog_token(new_token) {
            break;
        }

        let piece = model
            .token_to_str(new_token, Special::Tokenize)
            .map_err(|e| format!("Error decodificando token: {}", e))?;

        output.push_str(&piece);

        if stream_to_frontend {
            emit("summary_segment", &piece, None);
            if i % 10 == 0 {
                let progress = ((i as f32 / max_tokens as f32) * 100.0) as u32;
                emit("summary_progress", "Generando resumen", Some(progress));
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
) -> Result<String, String> {
    let model_name = llm_model.unwrap_or(DEFAULT_LLM_MODEL);

    // 1. Descargar modelo si no existe
    emit("summary_progress", &format!("Preparando modelo {}", model_name), None);
    if let Err(e) = ensure_model(&*emit, model_name) {
        return Err(format!("Error descargando modelo: {}", e));
    }

    // 2. Inicializar backend y cargar modelo
    emit("summary_progress", "Inicializando LLM", None);
    let backend = LlamaBackend::init().map_err(|e| format!("Backend error: {}", e))?;

    let model_path = get_model_path(model_name);
    let model_params = LlamaModelParams::default().with_n_gpu_layers(99);

    emit("summary_progress", "Cargando modelo LLM", None);
    let model = LlamaModel::load_from_file(&backend, model_path, &model_params)
        .map_err(|e| format!("Error cargando modelo: {}", e))?;

    // 3. Decidir estrategia segun tamaño del transcript
    if transcript.len() <= MAX_DIRECT_CHARS {
        // --- Resumen directo (transcript corto) ---
        let prompt = build_summary_prompt(transcript, model_name);
        emit("summary_progress", "Generando resumen", Some(0));
        let summary = run_inference(&model, &backend, &prompt, 500, &*emit, true)?;
        emit("summary_progress", "Resumen completado", Some(100));
        Ok(summary)
    } else {
        // --- Chunked: extraer ideas por sección, luego resumen final ---
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
                &format!("Extrayendo ideas: sección {}/{}", chunk_num, total_chunks),
                Some(((idx as f32 / total_chunks as f32) * 70.0) as u32),
            );

            let extraction_prompt = build_chunk_extraction_prompt(chunk, chunk_num, total_chunks, model_name);
            let ideas = run_inference(&model, &backend, &extraction_prompt, 300, &*emit, false)?;

            all_ideas.push_str(&format!("\n### Sección {}\n{}\n", chunk_num, ideas));
        }

        // Pase final: resumen consolidado con todas las ideas
        emit("summary_progress", "Generando resumen final consolidado...", Some(75));
        let final_prompt = build_final_summary_prompt(&all_ideas, model_name);
        let summary = run_inference(&model, &backend, &final_prompt, 500, &*emit, true)?;

        emit("summary_progress", "Resumen completado", Some(100));
        Ok(summary)
    }
}
