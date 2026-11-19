import { ReactNode } from "react";
import { cn } from "../lib/utils";
import { isMacOS } from "../services/runtime";

// El padding superior centra el título con el primer botón de la Sidebar,
// que en macOS baja para dejar libres los semáforos.
export const Page = ({
  title,
  toolbar,
  children,
}: {
  title: string;
  toolbar?: ReactNode;
  children: ReactNode;
}) => (
  <div className="h-full flex flex-col">
    <header
      className={cn(
        "shrink-0 px-6 pb-5 flex flex-col items-start gap-5",
        isMacOS() ? "pt-12.5" : "pt-7.5",
      )}
    >
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      {toolbar}
    </header>
    <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-1 pb-6">
      {children}
    </div>
  </div>
);
