import { invoke } from "@tauri-apps/api/core";

export type GpuKind = "discrete" | "integrated" | "other";

export interface GpuInfo {
  name: string;
  kind: GpuKind;
}

export const getGpus = () => invoke<GpuInfo[]>("get_gpus");
