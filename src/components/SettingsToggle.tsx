import { Settings } from "lucide-react";
import { VIEWS, useView } from "../hooks/useView";
import { cn } from "../lib/utils";

export const SettingsToggle = () => {
  const { view, setView } = useView();
  const open = view === VIEWS.settings;

  return (
    <button
      type="button"
      onClick={() => setView(open ? VIEWS.transcript : VIEWS.settings)}
      aria-label="Configuración"
      aria-pressed={open}
      title={open ? "Volver a transcripción" : "Configuración"}
      className={cn(
        "inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors",
        open
          ? "border-accent/60 bg-accent/10 text-accent"
          : "border-line text-muted hover:text-accent hover:border-accent/60",
      )}
    >
      <Settings size={12} strokeWidth={1.5} />
    </button>
  );
};
