use std::{fs::File, time::Instant};
use std::sync::Arc;

use nnnoiseless::DenoiseState;
use whisper_rs::{WhisperContext, WhisperContextParameters, FullParams, SamplingStrategy};
use rubato::{Resampler, SincFixedIn, SincInterpolationType, SincInterpolationParameters, WindowFunction};
use indicatif::{ProgressBar, ProgressStyle};
mod audio_decoder;

pub type EmitType = Arc<dyn Fn(&str, &str, Option<u32>) + Send + Sync>;

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
        let text = self.transcribe(&resampled);
    
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
     
     pub fn transcribe(&self, samples: &[f32]) -> String {
         let model_path = self.get_model_path(&self.whisper_model);
         let mut ctx_params = WhisperContextParameters::default();
         ctx_params.use_gpu(true);
         let ctx = WhisperContext::new_with_params(
             model_path.to_str().unwrap(),
             ctx_params
         ).expect("Failed to load the model");
     
         let mut params =
         FullParams::new(SamplingStrategy::Greedy {
         best_of: 1 });
         params.set_language(Some("es"));
         params.set_print_special(false);
         params.set_print_realtime(false);
         params.set_print_progress(false);
         // Anti-looping
         params.set_no_context(true);
         params.set_single_segment(false);
         params.set_suppress_blank(true);
         params.set_suppress_nst(true);
         params.set_temperature(0.0);
         params.set_entropy_thold(2.4);
         params.set_logprob_thold(-1.0);
         params.set_no_speech_thold(0.6);
         params.set_max_len(100);
     
     
         let emit_transcript = (self.emit).clone();
         params.set_progress_callback_safe(move |progress: i32| {
             emit_transcript("process", "transcribiendo", Some(progress as u32));
         });
     
         let emit_segment = (self.emit).clone();
         params.set_segment_callback_safe(move |data:
         whisper_rs::SegmentCallbackData| {
             emit_segment("transcript_segment", &data.text, Some(data.segment as
          u32));
         });
     
         let mut state = ctx.create_state().expect("Could not create state");
         state.full(params, samples).expect("Could not transcribe");
     
         let mut text = String::new();
         for segment in state.as_iter() {
             let segment_text = segment.to_string();
             text.push_str(&segment_text);
             text.push(' ');
         }
         text.trim().to_string()
     }
}
