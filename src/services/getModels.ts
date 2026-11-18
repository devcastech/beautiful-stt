import { invoke } from "@tauri-apps/api/core";

export interface ModelInfo {
  name: string;
  label: string;
  description: string;
  size: number;
  modified: number | undefined;
  downloaded: boolean;
  default: boolean;
}

export const getModelList = async () => {
  const models = await invoke<ModelInfo[]>("get_models");
  return models;
};
