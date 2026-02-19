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

const SYSTEM_PROMPT_ACTA: &str = "Eres un Secretario de Actas oficial de un cuerpo colegiado. \
    Tu misión es redactar actas formales, limpias y profesionales.\n\
    Reglas estrictas:\n\
    - SOLO usa información explícita del texto\n\
    - CORRECCIÓN CONTEXTUAL: corrige errores fonéticos de Whisper por contexto\n\
    - Identifica participantes por nombre cuando se mencionen\n\
    - Distingue claramente entre discusión, acuerdos formales y votaciones\n\
    - ACTOS PROTOCOLARIOS (oración, bendición, himno, minuto de silencio, juramentación, instalación): \
      son ceremoniales, NO se numeran en el orden del día ni se presentan como acuerdos. \
      Se mencionan en una sola frase de apertura antes del desarrollo sustantivo.\n\
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
fn build_final_summary_prompt(extracted_ideas: &str, entities: Option<&str>, model_name: &str) -> String {
    let instructions = format!(
        "{}A continuación tienes las ideas clave extraídas de una transcripción larga, procesada por secciones.\n\
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
        entities_block(entities), extracted_ideas
    );

    let system = SYSTEM_PROMPT;

    format_chat_prompt(system, &instructions, "## 1. Propósito y Contexto\n", model_name)
}

/// Valida que el string sea un objeto JSON mínimamente coherente.
/// No parsea en profundidad — detecta los casos más comunes de salida corrupta de modelos IQ2.
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

/// Prompt directo para transcripciones cortas
fn build_summary_prompt(transcript: &str, entities: Option<&str>, model_name: &str) -> String {
    let instructions = format!(
        "{}### REGLAS DE ORO DE SALIDA:\n\
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
        entities_block(entities), transcript
    );

    let system = SYSTEM_PROMPT;

    format_chat_prompt(system, &instructions, "## 1. Propósito y Contexto\n", model_name)
}

// ===================================================
// Prompts para modo "Acta"
// ===================================================

/// Prompt para extraer información de acta de un chunk individual.
/// `prev_context`: últimas líneas del chunk anterior para mantener coherencia narrativa.
fn build_chunk_extraction_acta_prompt(
    chunk: &str,
    chunk_num: usize,
    total_chunks: usize,
    prev_context: Option<&str>,
    model_name: &str,
) -> String {
    let continuity = match prev_context {
        Some(ctx) => format!(
            "La sección anterior cerró con:\n\"{}\"\nContinúa desde ahí sin repetir lo ya dicho.\n\n",
            ctx
        ),
        None => String::new(),
    };

    let instructions = format!(
        "{}Sección {} de {}.\n\n\
        Redacta un párrafo formal y denso de lo ocurrido en este fragmento de sesión.\n\
        - Usa conectores jurídicos: \"Acto seguido\", \"En uso de la palabra\", \"Se sometió a votación\", \"Se acordó\".\n\
        - Incluye nombres propios, cifras y referencias legales si aparecen.\n\
        - ACTOS PROTOCOLARIOS (oración, bendición, himno, instalación): una sola frase descriptiva, \
          sin tratarlos como acuerdos ni puntos de votación.\n\
        - Omite asistencias, saludos y fórmulas de apertura o cierre.\n\
        - Corrige errores fonéticos de Whisper por contexto.\n\
        - Sin viñetas ni listas. Solo prosa formal.\n\n\
        FRAGMENTO:\n{}\n\n\
        PÁRRAFO FORMAL:",
        continuity, chunk_num, total_chunks, chunk
    );

    let system = "Eres un Secretario de Actas oficial. \
        Redactas actas con lenguaje jurídico preciso y prosa formal. \
        Solo usas información explícita del texto. Responde en español.";

    format_chat_prompt(system, &instructions, "", model_name)
}

/// Prompt final de acta que consolida los párrafos extraídos de los chunks.
fn build_final_acta_prompt(extracted_ideas: &str, entities: Option<&str>, model_name: &str) -> String {
    let instructions = format!(
        "{}Tienes los resúmenes formales de todas las secciones de una sesión oficial.\n\
        Consolídalos en un acta única, coherente y sin repeticiones.\n\n\
        REGLAS:\n\
        - OMITE: listas de asistencia, lugar, fecha, fórmulas de apertura y cierre.\n\
        - ACTOS PROTOCOLARIOS (oración, bendición, himno, instalación, minuto de silencio): \
          menciónalos en UNA sola frase al inicio del DESARROLLO. NO los numeres en el ORDEN DEL DÍA.\n\
        - ORDEN DEL DÍA: solo temas sustantivos (lo que se discutió, propuso o votó).\n\
        - DESARROLLO: prosa formal, un párrafo por tema. Usa conectores jurídicos.\n\
        - ELIMINA redundancias entre secciones.\n\
        - ACUERDOS y COMPROMISOS en lista numerada.\n\
        - Corrige errores fonéticos por contexto.\n\n\
        SECCIONES PROCESADAS:\n{}\n\n\
        GENERA SOLO ESTO (omite secciones sin información suficiente):\n\n\
        ORDEN DEL DÍA\n\
        (Solo temas sustantivos numerados. Sin actos protocolarios.)\n\n\
        DESARROLLO\n\
        (Primera línea: acto protocolario si lo hay. Luego un párrafo por cada tema.)\n\n\
        ACUERDOS Y VOTACIONES\n\
        (Resoluciones formales con resultado de votación si lo hay.)\n\n\
        COMPROMISOS Y SEGUIMIENTO\n\
        (Tareas, responsables y plazos.)",
        entities_block(entities), extracted_ideas
    );

    format_chat_prompt(SYSTEM_PROMPT_ACTA, &instructions, "ORDEN DEL DÍA\n", model_name)
}

/// Prompt directo de acta para transcripciones cortas
fn build_acta_prompt(transcript: &str, entities: Option<&str>, model_name: &str) -> String {
    let instructions = format!(
        "{}Redacta el acta formal de esta sesión.\n\
        - OMITE: listas de asistencia, lugar, fecha, saludos.\n\
        - ACTOS PROTOCOLARIOS (oración, bendición, himno, instalación): una sola frase al inicio del DESARROLLO. NO van en el ORDEN DEL DÍA.\n\
        - ORDEN DEL DÍA: solo temas sustantivos numerados (lo que se discute, propone o vota).\n\
        - DESARROLLO: prosa formal con conectores jurídicos (\"Acto seguido\", \"En uso de la palabra\", \"Se acordó\"). Un párrafo por tema.\n\
        - ACUERDOS y COMPROMISOS: lista numerada con el texto formal del acuerdo.\n\
        - Corrige errores fonéticos de Whisper por contexto.\n\
        - Omite secciones sin información suficiente.\n\n\
        TRANSCRIPCIÓN:\n{}\n\n\
        GENERA SOLO ESTO:\n\n\
        ORDEN DEL DÍA\n\
        (Solo temas sustantivos numerados. Sin actos protocolarios.)\n\n\
        DESARROLLO\n\
        (Primera línea: acto protocolario si lo hay. Luego un párrafo por cada tema del orden del día.)\n\n\
        ACUERDOS Y VOTACIONES\n\
        (Resoluciones formales adoptadas con resultado.)\n\n\
        COMPROMISOS Y SEGUIMIENTO\n\
        (Tareas, responsables y plazos.)",
        entities_block(entities), transcript
    );

    format_chat_prompt(SYSTEM_PROMPT_ACTA, &instructions, "ORDEN DEL DÍA\n", model_name)
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
// Extracción de entidades con Gemma (modelo especializado)
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
/// Imprime el resultado en consola para debugging.
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
    let is_acta = output_mode.unwrap_or("summary") == "acta";

    let mode_label = if is_acta { "acta" } else { "resumen" };

    // 1. Descargar ambos modelos si no existen
    emit("summary_progress", &format!("Preparando modelo {}", model_name), None);
    if let Err(e) = ensure_model(&*emit, model_name) {
        return Err(format!("Error descargando modelo: {}", e));
    }

    // 2. Inicializar backend (compartido entre Gemma y modelo principal)
    emit("summary_progress", "Inicializando LLM", None);
    let backend = LlamaBackend::init().map_err(|e| format!("Backend error: {}", e))?;

    // 3. Gemma extrae entidades primero — bloque acotado para liberar RAM antes del main LLM
    emit("summary_progress", "Extrayendo ideas clave con Gemma...", None);
    let entities: Option<String> = {
        let src: String = transcript.chars().take(5000).collect();
        match extract_entities_with_gemma(&*emit, &backend, &src) {
            Ok(json) => {
                emit("summary_progress", "Ideas clave extraídas — iniciando análisis principal", None);
                Some(json)
            }
            Err(e) => {
                println!("[GEMMA ENTITIES] No disponible: {}", e);
                emit("summary_progress", &format!("Gemma no disponible ({}), continuando sin contexto de entidades", e), None);
                None
            }
        }
    }; // Gemma liberada aquí

    let model_path = get_model_path(model_name);
    let model_params = LlamaModelParams::default().with_n_gpu_layers(99);

    // 4. Main LLM genera el resumen/acta con las entidades como contexto de grounding
    emit("summary_progress", "Cargando modelo LLM", None);
    let model = LlamaModel::load_from_file(&backend, model_path, &model_params)
        .map_err(|e| format!("Error cargando modelo: {}", e))?;

    let summary = if transcript.len() <= MAX_DIRECT_CHARS {
        // --- Directo (transcript corto) ---
        let prompt = if is_acta {
            build_acta_prompt(transcript, entities.as_deref(), model_name)
        } else {
            build_summary_prompt(transcript, entities.as_deref(), model_name)
        };
        emit("summary_progress", &format!("Generando {}", mode_label), Some(0));
        let max_tokens = if is_acta { 700 } else { 500 };
        run_inference(&model, &backend, &prompt, max_tokens, &*emit, true)?
    } else {
        // --- Chunked ---
        let chunks = split_into_chunks(transcript, CHUNK_SIZE);
        let total_chunks = chunks.len();
        let mut all_ideas = String::new();
        let mut prev_chunk_tail: Option<String> = None;

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

            let extraction_prompt = if is_acta {
                build_chunk_extraction_acta_prompt(
                    chunk, chunk_num, total_chunks,
                    prev_chunk_tail.as_deref(), model_name,
                )
            } else {
                build_chunk_extraction_prompt(chunk, chunk_num, total_chunks, model_name)
            };

            let chunk_tokens = if is_acta { 400 } else { 300 };
            let ideas = run_inference(&model, &backend, &extraction_prompt, chunk_tokens, &*emit, false)?;

            if is_acta {
                let tail_start = ideas.len().saturating_sub(250);
                let tail_start = ideas[tail_start..]
                    .find(' ')
                    .map(|i| tail_start + i + 1)
                    .unwrap_or(tail_start);
                prev_chunk_tail = Some(ideas[tail_start..].trim().to_string());
            }

            all_ideas.push_str(&format!("\n### Sección {}\n{}\n", chunk_num, ideas));
        }

        // Pase final: consolida ideas + entidades verificadas de Gemma
        emit("summary_progress", &format!("Generando {} final consolidado...", mode_label), Some(75));
        let final_prompt = if is_acta {
            build_final_acta_prompt(&all_ideas, entities.as_deref(), model_name)
        } else {
            build_final_summary_prompt(&all_ideas, entities.as_deref(), model_name)
        };
        let final_tokens = if is_acta { 900 } else { 500 };
        run_inference(&model, &backend, &final_prompt, final_tokens, &*emit, true)?
    };

    emit("summary_progress", &format!("{} completado", if is_acta { "Acta" } else { "Resumen" }), Some(100));
    Ok(summary)
}
