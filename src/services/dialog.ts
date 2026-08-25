import { isTauriRuntime } from "./runtime";

export async function alertDialog(
  message: string,
  title?: string,
  kind: "info" | "warning" | "error" = "info",
): Promise<void> {
  if (isTauriRuntime()) {
    const { message: showMessage } = await import("@tauri-apps/plugin-dialog");
    await showMessage(message, { title, kind });
    return;
  }
  window.alert(message);
}

export async function saveTextFileAs(
  defaultFileName: string,
  contents: string,
): Promise<boolean> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const path = await save({
    defaultPath: defaultFileName,
    filters: [{ name: "transcript", extensions: ["txt"] }],
  });
  if (!path) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("save_text_file", { path, contents });
  return true;
}
