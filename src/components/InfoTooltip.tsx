import { ReactNode, useEffect, useId, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "../lib/utils";

type InfoTooltipProps = {
  /** Nombre accesible del botón, p. ej. "Más información sobre Nivel de precisión". */
  label: string;
  /** Contenido del tooltip. Sin elementos interactivos: se lee como descripción del botón. */
  children: ReactNode;
  className?: string;
};

/** El contenido va enlazado con aria-describedby, así que se lee aunque esté oculto. */
export const InfoTooltip = ({ label, children, className }: InfoTooltipProps) => {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  // Escape lo cierra aunque el foco no esté en el botón (WCAG 1.4.13).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-full text-muted hover:text-text transition-colors cursor-help"
      >
        <Info size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {/* El pt-2 hace de puente: el puntero pasa del icono al tooltip sin cerrarlo. */}
      <span
        id={tooltipId}
        role="tooltip"
        hidden={!open}
        className="absolute left-0 top-full z-30 pt-2 w-64"
      >
        <span className="block rounded-xl bg-accent text-on-accent px-3 py-2 text-xs leading-relaxed shadow-xl">
          {children}
        </span>
      </span>
    </span>
  );
};
