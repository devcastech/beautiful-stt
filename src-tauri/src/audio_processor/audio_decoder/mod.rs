use std::fs::File;
use std::path::Path;

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

pub struct AudioData {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
}

pub fn decode(path: &str) -> Result<AudioData, Box<dyn std::error::Error>> {
    let extension = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    match extension.to_lowercase().as_str() {
        "opus" => decode_opus(path),
        "wav" | "mp3" | "flac" | "ogg" | "m4a" => decode_symphonia(path),
        _ => Err(format!("Formato no soportado: {}", extension).into()),
    }
}

fn decode_symphonia(path: &str) -> Result<AudioData, Box<dyn std::error::Error>> {
    let file = File::open(path)?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = Path::new(path).extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())?;

    let mut format = probed.format;
    let track = format.default_track().ok_or("No track found")?;
    let sample_rate = track.codec_params.sample_rate.ok_or("No sample rate")?;
    let channels = track.codec_params.channels.ok_or("No channels")?.count();

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())?;

    let mut samples: Vec<f32> = Vec::new();

    while let Ok(packet) = format.next_packet() {
        if let Ok(decoded) = decoder.decode(&packet) {
            let spec = *decoded.spec();
            let mut sample_buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
            sample_buf.copy_interleaved_ref(decoded);
            samples.extend(sample_buf.samples());
        }
    }

    let mono = if channels == 2 {
        samples.chunks(2).map(|c| (c[0] + c[1]) / 2.0).collect()
    } else {
        samples
    };

    Ok(AudioData { samples: mono, sample_rate })
}

fn decode_opus(path: &str) -> Result<AudioData, Box<dyn std::error::Error>> {
    let file = File::open(path)?;
    let mut ogg_reader = ogg::PacketReader::new(file);

    let mut decoder: Option<opus::Decoder> = None;
    let mut samples: Vec<f32> = Vec::new();
    let mut channels = 2usize;

    while let Some(packet) = ogg_reader.read_packet()? {
        if decoder.is_none() {
            if packet.data.starts_with(b"OpusHead") {
                channels = packet.data[9] as usize;
                decoder = Some(opus::Decoder::new(
                    48000,
                    if channels == 1 { opus::Channels::Mono } else { opus::Channels::Stereo }
                )?);
            }
            continue;
        }

        if packet.data.starts_with(b"OpusTags") {
            continue;
        }

        if let Some(ref mut dec) = decoder {
            let mut output = vec![0.0f32; 5760 * channels];
            if let Ok(len) = dec.decode_float(&packet.data, &mut output, false) {
                samples.extend(&output[..len * channels]);
            }
        }
    }

    let mono = if channels == 2 {
        samples.chunks(2).map(|c| (c[0] + c[1]) / 2.0).collect()
    } else {
        samples
    };

    Ok(AudioData { samples: mono, sample_rate: 48000 })
}