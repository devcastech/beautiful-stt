import { isMacOS } from "../services/runtime";
import { cn } from "../lib/utils";
import { WindowControls } from "./WindowControls";

// Se superpone al contenido. Fuera de macOS empieza después de la Sidebar
// (w-19) para no tapar sus botones; en macOS la Sidebar deja libre esa franja
// para los semáforos.
export const Header = () => {
  return (
    <header
      data-tauri-drag-region
      className={cn(
        "absolute top-0 right-0 z-10 h-10 flex justify-end items-center pr-2",
        isMacOS() ? "left-0" : "left-19",
      )}
    >
      <WindowControls />
    </header>
  );
};
