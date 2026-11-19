import { invoke } from "@tauri-apps/api/core";

export const deleteModel = async (model: string) => {
  return await invoke("delete_model", { model });
};
