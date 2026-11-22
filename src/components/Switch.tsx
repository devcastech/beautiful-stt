import { ReactNode, useId } from "react";
import { cn } from "../lib/utils";
import { InfoTooltip } from "./InfoTooltip";

type SwitchProps = {
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export const Switch = ({ label, hint, checked, onChange }: SwitchProps) => {
  const labelId = `${useId()}-label`;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1.5">
        <span id={labelId} className="text-sm">
          {label}
        </span>
        {hint && (
          <InfoTooltip label={`Más información sobre ${label}`}>
            {hint}
          </InfoTooltip>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        onClick={() => onChange(!checked)}
        className={cn(
          "inline-flex items-center h-6 w-10 shrink-0 rounded-full transition-colors cursor-pointer",
          checked ? "bg-accent" : "bg-line",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "h-5 w-5 rounded-full shadow-sm transition-transform",
            checked
              ? "translate-x-[18px] bg-on-accent"
              : "translate-x-0.5 bg-muted",
          )}
        />
      </button>
    </div>
  );
};
