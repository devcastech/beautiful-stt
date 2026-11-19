import { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/utils";

type RailButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
};

export const RailButton = ({
  label,
  active = false,
  className,
  children,
  ...props
}: RailButtonProps) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={cn(
      "relative inline-flex items-center justify-center w-11 h-11 rounded-full cursor-pointer transition-colors disabled:cursor-default",
      active
        ? "bg-surface dark:bg-elevated text-text shadow-sm ring-1 ring-line"
        : "text-muted hover:bg-surface/60 hover:text-text",
      className,
    )}
    {...props}
  >
    {children}
  </button>
);
