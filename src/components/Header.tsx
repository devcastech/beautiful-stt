import { isMacOS } from "../services/runtime";
import { WindowControls } from "./WindowControls";

export const Header = () => {
  return (
    <header
      data-tauri-drag-region
      className={`flex justify-between items-center gap-3 h-12 shrink-0 bg-surface/60 pr-2 ${isMacOS() ? "pl-19.5" : "pl-8"}`}
    >
      <div data-tauri-drag-region className="flex items-center gap-3">
        <img
          src="/logo.png"
          className="w-5 h-5 object-contain opacity-70"
          alt=""
        />
        <h1 className="font-mono text-sm font-bold">Beautiful STT</h1>
      </div>
      <WindowControls />
    </header>
  );
};
