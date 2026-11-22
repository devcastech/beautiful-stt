import { invoke } from "@tauri-apps/api/core";

export type Device = { type: "cpu" } | { type: "gpu"; name: string | null };

export interface TranscriptionParams {
  model: string;
  device: Device;
  beam_size: number;
  threads: number;
  vad: boolean;
}

export interface TranscriptionOutput {
  text: string;
  params: TranscriptionParams | null;
}

export const getTranscriptionParams = (model: string) =>
  invoke<TranscriptionParams>("get_transcription_params", { model });

export const transcribeAudio = (filePath: string, whisperModel: string) =>
  invoke<TranscriptionOutput>("process_audio_file", { filePath, whisperModel });
