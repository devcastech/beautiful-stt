import { KeyboardEvent, ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

export type SegmentedTabItem<T extends string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
};

const tabId = (idBase: string, id: string) => `${idBase}-tab-${id}`;
const panelId = (idBase: string, id: string) => `${idBase}-panel-${id}`;

type SegmentedTabsProps<T extends string> = {
  items: readonly SegmentedTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** Prefijo único para enlazar cada tab con su <TabPanel>. */
  idBase: string;
  fullWidth?: boolean;
  className?: string;
};

export const SegmentedTabs = <T extends string>({
  items,
  value,
  onChange,
  label,
  idBase,
  fullWidth = false,
  className,
}: SegmentedTabsProps<T>) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = items.findIndex((i) => i.id === value);
    const last = items.length - 1;
    const targets: Record<string, number> = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowLeft: current <= 0 ? last : current - 1,
      Home: 0,
      End: last,
    };
    const next = targets[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onChange(items[next].id);
    e.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn(
        "items-center gap-1 p-1 rounded-full bg-sunken",
        fullWidth ? "flex w-full" : "inline-flex",
        className,
      )}
    >
      {items.map(({ id, label: itemLabel, icon: Icon }) => {
        const selected = id === value;
        return (
          <button
            key={id}
            id={tabId(idBase, id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={selected ? panelId(idBase, id) : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap cursor-pointer transition-colors",
              fullWidth && "flex-1",
              selected
                ? "bg-surface dark:bg-elevated text-text shadow-sm"
                : "text-muted hover:text-text",
            )}
          >
            {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden="true" />}
            {itemLabel}
          </button>
        );
      })}
    </div>
  );
};

export const TabPanel = ({
  idBase,
  value,
  className,
  children,
}: {
  idBase: string;
  value: string;
  className?: string;
  children: ReactNode;
}) => (
  <div
    role="tabpanel"
    id={panelId(idBase, value)}
    aria-labelledby={tabId(idBase, value)}
    className={className}
  >
    {children}
  </div>
);
