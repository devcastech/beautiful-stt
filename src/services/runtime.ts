/** True when running inside the Tauri desktop shell (vs. plain browser dev). */
export const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * True on macOS. On macOS we keep the native traffic lights (via
 * `titleBarStyle: Overlay`) instead of drawing custom window controls.
 */
export const isMacOS = (): boolean =>
  typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
