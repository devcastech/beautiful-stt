use std::{fs::File, time::Instant};
use std::sync::Arc;

use nnnoiseless::DenoiseState;
use whisper_rs::{WhisperContext, WhisperContextParameters, FullParams, SamplingStrategy, WhisperVadParams};
use rubato::{Resampler, SincFixedIn, SincInterpolationType, SincInterpolationParameters, WindowFunction};
use indicatif::{ProgressBar, ProgressStyle};
mod audio_decoder;

pub type EmitType = Arc<dyn Fn(&str, &str, Option<u32>) + Send + Sync>;

const VAD_MODEL_NAME: &str = "ggml-silero-v6.2.0.bin";
const VAD_MODEL_URL: &str = "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin";

pub struct AudioProcessor{
    emit: EmitType,
    file_path: String,
    whisper_model: String,
}

impl AudioProcessor{
    pub fn new(emit: EmitType, file_path: String, whisper_model: String) -> Self {
        whisper_rs::install_logging_hooks();
        AudioProcessor {
            emit,
            file_path,
            whisper_model,
        }
    }
    
    pub fn process(&self) -> String {
        (self.emit)("process", &format!("validando disponibilidad del modelo {}", self.whisper_model), None);
        if let Err(e) = self.ensure_model(&*self.emit, &self.whisper_model){
            println!("Failed to ensure model: {}", e);
            (self.emit)("process", "hubo un error descargando el modelo".into(), None);
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
        let audio = audio_decoder::decode(&self.file_path)
            .unwrap_or_else(|e| {
                eprintln!("Error decodificando {}: {}", self.file_path, e);
                panic!("Error decoding audio: {}", e);
            });
    
        println!("Sample rate: {}", audio.sample_rate);
        println!("Samples: {}", audio.samples.len());
    
        // (self.emit)("process", &format!("sample rate {}", audio.sample_rate), None);
        // (self.emit)("process", &format!("samples {}", audio.samples.len()), None);
        (self.emit)("process", &format!("preparando audio  {} HZ y {} muestras", audio.sample_rate, audio.samples.len()), None);
        let clean = self.clean_audio(audio.samples);
        let resampled = self.resample(&clean, audio.sample_rate, 16000);
    
        (self.emit)("process", "iniciando transcripción".into(), None);
        let text = self.transcribe(&resampled, vad_path.as_deref());
    
        let elapsed = total.elapsed().as_secs();
        (self.emit)("process", &format!("Proceso completado en {:?} segundos", elapsed), None);
        text
    }
    
    pub fn clean_audio(&self, samples: Vec<f32>) -> Vec<f32>{
        let mut denoiser = DenoiseState::new();
        let mut clean: Vec<f32> = Vec::new();
        let chunks: Vec<_> = samples.chunks(480).collect();
    
        let pb = ProgressBar::new(chunks.len() as u64);
        pb.set_style(ProgressStyle::default_bar()
            .template("{spinner:.green} [{bar:40.cyan/blue}] {pos}/{len} ({eta})")
            .unwrap()
            .progress_chars("#>-"));
    
        for chunk in chunks {
            let mut input = [0.0f32; 480];
            let mut output = [0.0f32; 480];
    
            for (i, &sample) in chunk.iter().enumerate(){
                input[i] = sample;
            }
            denoiser.process_frame(&mut output, &input);
            clean.extend_from_slice(&output[..chunk.len()]);
            pb.inc(1);
        }
    
        clean
    }
    
    pub fn get_model_path(&self, whisper_model: &str) -> std::path::PathBuf {
         std::env::current_exe()
             .ok()
             .and_then(|p| p.parent().map(|p| p.to_path_buf()))
             .unwrap_or_default()
             .join(whisper_model)
     }
   
     pub fn ensure_model(&self, emit: &dyn Fn(&str, &str,Option<u32>), whisper_model: &str) -> Result<(), Box<dyn std::error::Error>> {
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

     pub fn resample(&self, samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
         let params = SincInterpolationParameters {
             sinc_len: 256,
             f_cutoff: 0.95,
             interpolation: SincInterpolationType::Linear,
             oversampling_factor: 256,
             window: WindowFunction::BlackmanHarris2,
         };
     
         let mut resampler = SincFixedIn::<f32>::new(
             to_rate as f64 / from_rate as f64,
             2.0,
             params,
             samples.len(),
             1,
         ).unwrap();
     
         let waves_in = vec![samples.to_vec()];
         let mut waves_out = resampler.process(&waves_in, None).unwrap();
     
         waves_out.remove(0)
     }
     
     pub fn transcribe(&self, samples: &[f32], vad_model_path: Option<&std::path::Path>) -> String {
         let model_path = self.get_model_path(&self.whisper_model);
         let mut ctx_params = WhisperContextParameters::default();
         ctx_params.use_gpu(true);
         let ctx = WhisperContext::new_with_params(
             model_path.to_str().unwrap(),
             ctx_params
         ).expect("Failed to load the model");

         let mut state = ctx.create_state().expect("Could not create state");

         // Procesar en chunks de 30s independientes.
         // Cada chunk tiene contexto limpio: un loop en el himno no contamina el debate siguiente.
         const CHUNK_SAMPLES: usize = 30 * 16000;
         let chunks: Vec<&[f32]> = samples.chunks(CHUNK_SAMPLES).collect();
         let total_chunks = chunks.len();
         let mut full_text = String::new();

         for (idx, chunk) in chunks.iter().enumerate() {
             // FullParams es consumido por state.full(), se reconstruye por chunk
             let mut params = FullParams::new(SamplingStrategy::BeamSearch {
                 beam_size: 5,
                 patience: 0.0,
             });

             params.set_language(Some("es"));
             params.set_print_special(false);
             params.set_print_realtime(false);
             params.set_print_progress(false);
             params.set_initial_prompt(
                 "Transcripción profesional de audio. Contenido formal, sin publicidad, \
                  sin menciones a redes sociales ni suscripciones."
             );
             params.set_temperature(0.0);
             params.set_no_context(true);
             params.set_suppress_blank(true);
             params.set_suppress_nst(true);
             params.set_no_speech_thold(0.2);
             params.set_entropy_thold(2.0);
             params.set_logprob_thold(-0.5);
             params.set_max_len(50);

             if let Some(vad_path) = vad_model_path {
                 params.set_vad_model_path(Some(vad_path.to_str().unwrap()));
                 let mut vad_params = WhisperVadParams::new();
                 vad_params.set_threshold(0.9);
                 vad_params.set_min_speech_duration(300);
                 vad_params.set_min_silence_duration(100);
                 vad_params.set_speech_pad(30);
                 params.set_vad_params(vad_params);
                 params.enable_vad(true);
             }

             let emit_progress = (self.emit).clone();
             params.set_progress_callback_safe(move |progress: i32| {
                 let overall = ((idx as f32 + progress as f32 / 100.0) / total_chunks as f32 * 100.0) as u32;
                 emit_progress("process", "transcribiendo", Some(overall));
             });

             let emit_segment = (self.emit).clone();
             params.set_segment_callback_safe(move |data: whisper_rs::SegmentCallbackData| {
                 emit_segment("transcript_segment", &data.text, Some(data.segment as u32));
             });

             (self.emit)("process", &format!("transcribiendo segmento {}/{}", idx + 1, total_chunks), None);
             state.full(params, chunk).expect("Could not transcribe chunk");

             let mut chunk_text = String::new();
             for segment in state.as_iter() {
                 chunk_text.push_str(&segment.to_string());
                 chunk_text.push(' ');
             }
             let chunk_text = chunk_text.trim().to_string();

             if has_transcription_loop(&chunk_text) {
                 (self.emit)("process", &format!("segmento {}/{}: audio no transcribible omitido", idx + 1, total_chunks), None);
                 // No añadimos el segmento musical al transcript
             } else if !chunk_text.is_empty() {
                 if !full_text.is_empty() {
                     full_text.push(' ');
                 }
                 full_text.push_str(&chunk_text);
             }
         }

         full_text.trim().to_string()
     }
}

/// Detecta si el texto de un chunk es un loop de Whisper.
/// Un loop se define como la misma ventana de 5 palabras repetida 5+ veces consecutivas.
/// El habla humana natural no repite frases exactas más de 3-4 veces seguidas.
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
