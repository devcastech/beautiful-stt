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

const DEFAULT_LLM_MODEL: &str = "qwen2.5-1.5b-instruct-q4_k_m.gguf";

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
        let repo = if model_name.contains("Phi") {
            "bartowski/Phi-3.5-mini-instruct-GGUF"
        } else if model_name.contains("Llama") {
            "bartowski/Llama-3.2-3B-Instruct-GGUF"
        } else {
            "Qwen2.5-3B-Instruct-GGUF"
        };
      
        let model_url = format!(
            "https://huggingface.co/{}/resolve/main/{}",
            repo, model_name
        );

        // // URL de HuggingFace para Qwen2.5 Instruct GGUF
        // let model_url = format!(
        //     "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/{}",
        //     model_name
        // );

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

fn build_summary_prompt(transcript: &str, model_name: &str) -> String {
      let max_chars = 6000;
      let truncated = if transcript.len() > max_chars {
          &transcript[..max_chars]
      } else {
          transcript
      };

      let instructions = format!(
          "Genera EXACTAMENTE este formato sin preámbulos:\n\n\
          RESUMEN:\n\
          [Un párrafo corto de qué trata la conversación]\n\n\
          IDEAS CLAVE:\n\
          - [idea 1]\n\
          - [idea 2]\n\
          - [idea 3]\n\n\
          Genera SOLO el resumen y las ideas clave. Termina después de la
  última idea clave.\n\n\
          Transcripción a resumir:\n{}",
          truncated
      );

      let system = "Eres un asistente que resume transcripciones. Reglas
  estrictas:\n\
          - SOLO usa información explícita del texto\n\
          - NO interpretes, NO supongas, NO agregues contexto externo\n\
          - Sé breve y directo\n\
          - Responde en español";

      if model_name.contains("Phi") {
          // Phi-3.5 usa <|system|>...<|end|> formato
          format!(
              "<|system|>\n{}<|end|>\n\
              <|user|>\n{}<|end|>\n\
              <|assistant|>\nRESUMEN:\n",
              system, instructions
          )
        
      } else if model_name.contains("Llama") {
            // Llama 3.2 formato
            format!(
                "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n\
                {}<|eot_id|>\n\
                <|start_header_id|>user<|end_header_id|>\n\n\
                {}<|eot_id|>\n\
                <|start_header_id|>assistant<|end_header_id|>\n\nRESUMEN:\n",
                system, instructions
            )      }
      else {
          // Qwen usa ChatML <|im_start|>...<|im_end|>
          format!(
              "<|im_start|>system\n{}<|im_end|>\n\
              <|im_start|>user\n{}<|im_end|>\n\
              <|im_start|>assistant\nRESUMEN:\n",
              system, instructions
          )
      }
}

// ===================================================
// PASO 2.3: Funcion principal de resumen
// ===================================================

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

    // 2. Inicializar backend de llama.cpp
    emit("summary_progress", "Inicializando LLM", None);
    let backend = LlamaBackend::init().map_err(|e| format!("Backend error: {}", e))?;

    // 3. Cargar modelo con GPU si esta disponible
    let model_path = get_model_path(model_name);

    // n_gpu_layers(99) = offload todas las capas a GPU
    // Si no hay GPU (no se compilo con metal/cuda), esto se ignora
    let model_params = LlamaModelParams::default().with_n_gpu_layers(99);

    emit("summary_progress", "Cargando modelo LLM", None);
    let model = LlamaModel::load_from_file(&backend, model_path, &model_params)
        .map_err(|e| format!("Error cargando modelo: {}", e))?;

    // 4. Crear contexto de inferencia
    let ctx_params = LlamaContextParams::default()
        .with_n_ctx(std::num::NonZeroU32::new(4096)) // ventana de contexto
        .with_n_batch(512);

    let mut ctx = model
        .new_context(&backend, ctx_params)
        .map_err(|e| format!("Error creando contexto: {}", e))?;

    // 5. Tokenizar el prompt
    let prompt = build_summary_prompt(transcript, model_name);
    emit("summary_progress", "Generando resumen", Some(0));

    let tokens = model
        .str_to_token(&prompt, AddBos::Always)
        .map_err(|e| format!("Error tokenizando: {}", e))?;

    // 6. Evaluar tokens del prompt (batch processing)
    // let mut batch = LlamaBatch::new(4096, 1);

    // let last_index = tokens.len() as i32 - 1;
    // for (i, token) in tokens.iter().enumerate() {
    //     // Solo el ultimo token necesita logits (para generar el siguiente)
    //     let is_last = i as i32 == last_index;
    //     batch
    //         .add(*token, i as i32, &[0], is_last)
    //         .map_err(|e| format!("Error en batch: {}", e))?;
    // }

    // ctx.decode(&mut batch)
    //     .map_err(|e| format!("Error decodificando prompt: {}", e))?;
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

    // 7. Generacion autoregresiva con streaming
    //    Mismo patron que whisper segment_callback (audio_processor.rs:208-213)
    let mut summary = String::new();
    let max_tokens: i32 = 300;
    let mut n_cur = tokens.len() as i32;

    // Crear sampler: temperatura 0.7 para balance creatividad/coherencia
    let mut sampler = LlamaSampler::chain_simple([
        LlamaSampler::temp(0.3),
        LlamaSampler::dist(42), // seed para reproducibilidad
    ]);

    for i in 0..max_tokens {
        // Samplear siguiente token
        let new_token = sampler.sample(&ctx, batch.n_tokens() - 1);

        // Verificar si es fin de generacion (End of Generation)
        if model.is_eog_token(new_token) {
            break;
        }

        // Convertir token a texto
        let piece = model
            .token_to_str(new_token, Special::Tokenize)
            .map_err(|e| format!("Error decodificando token: {}", e))?;

        summary.push_str(&piece);

        // Emitir segmento al frontend (streaming!)
        // Mismo patron que: emit_segment("transcript_segment", &data.text, ...)
        emit("summary_segment", &piece, None);

        // Progreso cada 10 tokens
        if i % 10 == 0 {
            let progress = ((i as f32 / max_tokens as f32) * 100.0) as u32;
            emit("summary_progress", "Generando resumen", Some(progress));
        }

        // Preparar batch para siguiente iteracion
        batch.clear();
        batch
            .add(new_token, n_cur, &[0], true)
            .map_err(|e| format!("Error en batch: {}", e))?;

        ctx.decode(&mut batch)
            .map_err(|e| format!("Error decodificando: {}", e))?;

        n_cur += 1;
    }

    emit("summary_progress", "Resumen completado", Some(100));
    Ok(summary.trim().to_string())
}