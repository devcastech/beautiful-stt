import { invoke } from "@tauri-apps/api/core";

export const downloadModel = async (model: string) => {
  return await invoke<string>("ensure_default_models", {
    filePath: "",
    whisperModel: model,
  });
};
