import { cn } from "../lib/utils";

type ProgressBarProps = {
  value?: number | null;
  label?: string;
  ariaLabel: string;
  className?: string;
};

export const ProgressBar = ({
  value,
  label,
  ariaLabel,
  className,
}: ProgressBarProps) => {
  const hasValue = value != null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || hasValue) && (
        <div className="flex justify-between gap-2 text-xs text-muted">
          <span className="truncate">{label}</span>
          {hasValue && <span className="shrink-0 tabular-nums">{value}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={hasValue ? value : undefined}
        className="w-full h-1.5 rounded-full bg-sunken overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-accent to-accent/25 transition-all duration-500 ease-out"
          style={{ width: `${hasValue ? value : 100}%` }}
        />
      </div>
    </div>
  );
};
