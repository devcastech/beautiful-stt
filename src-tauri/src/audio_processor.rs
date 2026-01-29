use std::{fs::File, time::Instant};
use std::path::Path;

use nnnoiseless::DenoiseState;
use hound::{ WavWriter, WavSpec, SampleFormat};
use whisper_rs::{WhisperContext, WhisperContextParameters, FullParams, SamplingStrategy};
use rubato::{Resampler, SincFixedIn, SincInterpolationType, SincInterpolationParameters, WindowFunction};
use indicatif::{ProgressBar, ProgressStyle};

mod audio_decoder;

const WHISPER_MODEL: &str = "ggml-large-v3.bin";

// fn main() {
//     let args: Vec<String> = env::args().collect();

//     if args.len() < 2 {
//         eprintln!("Usage: {} <audio_file>", args[0]);
//         std::process::exit(1);
//     }
//     let audio_path = &args[1];

//     whisper_rs::install_logging_hooks();
//     println!("audio: {}", audio_path);
//     println!("model: {}", WHISPER_MODEL);
//     proccess(audio_path);
// }

pub fn process_audio_file(file_path: &str) -> Result<String, String> {
    whisper_rs::install_logging_hooks();
    println!("audio: {}", file_path);
    println!("model: {}", WHISPER_MODEL);
    Ok(proccess(file_path))
}

fn get_output_name(input: &str) -> String {
     let path = Path::new(input);
     let stem = path.file_stem().unwrap_or_default().to_str().unwrap_or("output");
     let parent = path.parent().unwrap_or(Path::new(""));

     parent.join(format!("{}_cleaned.wav", stem))
         .to_string_lossy()
         .to_string()
 }
 fn get_model_path() -> std::path::PathBuf {
      std::env::current_exe()
          .ok()
          .and_then(|p| p.parent().map(|p| p.to_path_buf()))
          .unwrap_or_default()
          .join(WHISPER_MODEL)
  }

  fn ensure_model() -> Result<(), Box<dyn std::error::Error>> {
      let model_path = get_model_path();
      println!("Model path: {:?}", model_path);

      if !model_path.exists() {
          let model_url = format!(
              "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{}",
              WHISPER_MODEL
          );
          println!("Downloading model from: {}", model_url);
          let mut response = ureq::get(&model_url).call()?.into_reader();
          let mut file = File::create(&model_path)?;
          std::io::copy(&mut response, &mut file)?;
          println!("Model downloaded successfully");
      }
      Ok(())
  }

//  fn ensure_model() -> Result<(), Box<dyn std::error::Error>> {
//     let model = WHISPER_MODEL;
//     let model_path = Path::new(WHISPER_MODEL_PATH);
//     println!("Model path: {}", model_path.display());
//     if !model_path.exists() {
//         let model_url =format!("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{}", model);
//         println!("Model URL: {}", model_url);
//         let mut response = ureq::get(&model_url).call()?.into_reader();
//         println!("Request completed");
//         let mut file = File::create(model_path)?;
//         std::io::copy(&mut response, &mut file)?;
//         println!("File created");
//     }
//     Ok(())
// }
// fn ensure_model()  -> Result<(), Box<dyn std::error::Error>> {
//     let model = WHISPER_MODEL;
//     let model_path = Path::new(model).with_extension("bin");
//     if !model_path.exists() {
//         // https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin
//         let model_url = format!("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{}.bin", model);
//         let response = reqwest::blocking::get(&model_url)?.bytes()?;
//         let mut file = File::create(&model_path)?;
//         file.write_all(&response)?;
//     }
//     Ok(())
// }
fn proccess(audio_path: &str) -> String {
    if let Err(e) = ensure_model(){
        println!("Failed to ensure model: {}", e);
        return format!("failed to ensure model: {}", e);
    }
    println!("Model working");

    let total = Instant::now();
    let output_path = get_output_name(audio_path);

    let audio = audio_decoder::decode(audio_path)
        .unwrap_or_else(|e| {
            eprintln!("Error decodificando {}: {}", audio_path, e);
            panic!("Error decoding audio: {}", e);
        });

    println!("Sample rate: {}", audio.sample_rate);
    println!("Samples: {}", audio.samples.len());

    let clean = clean_audio(audio.samples);
    save_clean_audio(clean.clone(), audio.sample_rate, &output_path);

    // Resample -> 16kHz
    println!("Resampling to 16kHz...");
    let resampled = resample(&clean, audio.sample_rate, 16000);

    println!("Transcribing...");
    let text = transcribe(&resampled);
    println!("\n=== Transcription ===\n{}", text);

    let elapsed = total.elapsed();
    println!("Elapsed time: {:?}", elapsed);
    text
}

fn clean_audio(samples: Vec<f32>) -> Vec<f32>{
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

fn save_clean_audio(samples: Vec<f32>, sample_rate: u32, output_path: &str){
    let output_spec = WavSpec {
        channels: 1,
        sample_rate: sample_rate,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };

    let mut writer = WavWriter::create(output_path, output_spec ).unwrap();

    for sample in &samples {
        let sample_i16 = (*sample * 32767.0) as i16;
        writer.write_sample(sample_i16).unwrap();
    }

    writer.finalize().unwrap();
}

fn resample(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
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

fn transcribe(samples: &[f32]) -> String {
    let model_path = get_model_path();
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

    let pb = ProgressBar::new(100);
    pb.set_style(ProgressStyle::default_bar()
        .template("{spinner:.green} [{bar:40.yellow/red}] {pos}%")
        .unwrap()
        .progress_chars("#>-"));

    let pb_clone = pb.clone();
    params.set_progress_callback_safe(move |progress: i32| {
        pb_clone.set_position(progress as u64);
    });

    let mut state = ctx.create_state().expect("Could not create state");
    state.full(params, samples).expect("Could not transcribe");

    let mut text = String::new();
    for segment in state.as_iter() {
        text.push_str(&segment.to_string());
        text.push(' ');
    }
    text.trim().to_string()
}
