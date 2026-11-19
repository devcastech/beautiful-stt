import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

type SelectProps = {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Select propio (patrón WAI-ARIA "select-only combobox") para que se vea igual
 * en todos los OS. El foco se queda en el combobox; la opción activa se
 * comunica con aria-activedescendant.
 */
export const Select = ({
  label,
  options,
  value,
  onChange,
  placeholder = "Seleccionar",
  className,
}: SelectProps) => {
  const id = useId();
  const labelId = `${id}-label`;
  const listboxId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const listboxRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];
  const last = options.length - 1;

  const openList = (index: number) => {
    if (options.length === 0) return;
    setActiveIndex(Math.max(index, 0));
    setOpen(true);
  };

  const commit = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  };

  // Mantiene visible la opción activa al navegar con el teclado.
  useEffect(() => {
    if (!open) return;
    listboxRef.current?.children[activeIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [open, activeIndex]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Índice destino de cada tecla de navegación; si la lista está cerrada, la abre ahí.
    const targets: Record<string, number> = {
      ArrowDown: open ? Math.min(activeIndex + 1, last) : selectedIndex,
      ArrowUp: open ? Math.max(activeIndex - 1, 0) : selectedIndex,
      Home: 0,
      End: last,
    };
    const target = targets[e.key];

    if (target !== undefined) {
      e.preventDefault();
      if (open) setActiveIndex(target);
      else openList(target);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) commit(activeIndex);
      else openList(selectedIndex);
    } else if (open && e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (open && e.key === "Tab") {
      // Como el select nativo: confirma la opción activa y deja que el foco avance.
      commit(activeIndex);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span
        id={labelId}
        className="font-mono text-[10px] text-accent uppercase tracking-[0.18em]"
      >
        {label}
      </span>

      <div className="relative">
        <div
          role="combobox"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-activedescendant={
            open && activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          onClick={() => (open ? setOpen(false) : openList(selectedIndex))}
          onKeyDown={handleKeyDown}
          onBlur={() => setOpen(false)}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-bg text-sm cursor-pointer transition-colors",
            open
              ? "border-accent"
              : "border-line hover:border-accent/50 focus:border-accent",
          )}
        >
          <span className="flex items-baseline gap-2 min-w-0">
            {selected ? (
              <>
                <span className="text-text shrink-0">{selected.label}</span>
                {selected.description && (
                  <span className="text-muted text-xs truncate">
                    {selected.description}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted">{placeholder}</span>
            )}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className={cn(
              "text-muted shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        </div>

        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          tabIndex={-1}
          hidden={!open}
          // Evita que el combobox pierda el foco (y se cierre) al hacer clic en la lista.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-line bg-bg py-1 shadow-lg"
        >
          {options.map((option, index) => {
            const isSelected = index === selectedIndex;
            const oid = optionId(index);
            return (
              <li
                key={option.value}
                id={oid}
                role="option"
                aria-selected={isSelected}
                aria-labelledby={`${oid}-label`}
                aria-describedby={
                  option.description ? `${oid}-description` : undefined
                }
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => commit(index)}
                className={cn(
                  "flex items-start gap-2 px-3 py-2 cursor-pointer",
                  index === activeIndex && "bg-accent/10",
                )}
              >
                <Check
                  size={14}
                  strokeWidth={1.5}
                  className={cn(
                    "mt-0.5 shrink-0 text-accent",
                    !isSelected && "invisible",
                  )}
                />
                <span className="flex flex-col min-w-0">
                  <span
                    id={`${oid}-label`}
                    className={cn(
                      "text-sm",
                      isSelected ? "text-accent" : "text-text",
                    )}
                  >
                    {option.label}
                  </span>
                  {option.description && (
                    <span
                      id={`${oid}-description`}
                      className="text-xs text-muted"
                    >
                      {option.description}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
