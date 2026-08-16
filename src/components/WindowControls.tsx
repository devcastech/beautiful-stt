import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, Copy, X } from 'lucide-react';
import { isMacOS, isTauriRuntime } from '../services/runtime.ts';

/**
 * Custom minimize/maximize/close buttons for the frameless window.
 *
 * Rendered only on Windows/Linux in the desktop shell — macOS keeps its native
 * traffic lights (see `titleBarStyle: Overlay` in tauri.macos.conf.json), and a
 * plain browser tab has no window to control.
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime() || isMacOS()) return;
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void win.isMaximized().then(setMaximized);
    void win
      .onResized(() => void win.isMaximized().then(setMaximized))
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, []);

  if (!isTauriRuntime() || isMacOS()) return null;

  const win = getCurrentWindow();

  return (
    <div className="flex items-center shrink-0 -mr-2" aria-label="Window controls">
      <ControlButton label="Minimize" onClick={() => void win.minimize()}>
        <Minus size={15} aria-hidden="true" />
      </ControlButton>
      <ControlButton
        label={maximized ? 'Restore' : 'Maximize'}
        onClick={() => void win.toggleMaximize()}
      >
        {maximized ? <Copy size={12} aria-hidden="true" /> : <Square size={12} aria-hidden="true" />}
      </ControlButton>
      <ControlButton label="Close" danger onClick={() => void win.close()}>
        <X size={15} aria-hidden="true" />
      </ControlButton>
    </div>
  );
}

interface ControlButtonProps {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ControlButton({ label, danger = false, onClick, children }: ControlButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex items-center justify-center h-12 w-11 cursor-pointer text-muted transition-colors ${
        danger ? 'hover:bg-err hover:text-white' : 'hover:bg-elevated hover:text-primary'
      }`}
    >
      {children}
    </button>
  );
}
