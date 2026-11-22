import { invoke } from "@tauri-apps/api/core";

export interface AppSettings {
  default_model: string;
  /** null = auto  */
  beam_size: number | null;
  use_gpu: boolean;
  vad: boolean;
}

export const getSettings = () => invoke<AppSettings>("get_settings");

export const saveSettings = (newSettings: AppSettings) =>
  invoke<AppSettings>("save_settings", { newSettings });
