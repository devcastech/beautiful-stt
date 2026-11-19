import { AudioLines, LucideIcon, Settings } from "lucide-react";
import { VIEWS, View, useView } from "../hooks/useView";
import { useAppVersion } from "../hooks/useAppVersion";
import { useUpdater } from "../hooks/useUpdater";
import { cn } from "../lib/utils";
import { isMacOS } from "../services/runtime";
import { RailButton } from "./RailButton";
import { ThemeToggle } from "./ThemeToggle";

const NAV: { view: View; label: string; Icon: LucideIcon }[] = [
  { view: VIEWS.transcript, label: "Transcripción", Icon: AudioLines },
  { view: VIEWS.settings, label: "Configuración", Icon: Settings },
];

// El texto va dos veces: el de encima, en on-accent, se recorta al ancho del
// relleno para que el porcentaje se lea tanto sobre el relleno como sobre el gris.
const UPDATE_PILL =
  "w-17 py-1 rounded-2xl flex flex-col items-center leading-tight";

const UpdateProgress = ({
  percent,
  version,
}: {
  percent: number;
  version?: string;
}) => {
  const content = (
    <>
      <span className="text-[11px] font-mono tabular-nums">{percent}%</span>
      <span className="text-[10px] font-mono opacity-70">v{version}</span>
    </>
  );
  return (
    <span
      role="progressbar"
      aria-label={`Actualizando a v${version}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn(UPDATE_PILL, "relative overflow-hidden bg-elevated text-text")}
    >
      {content}
      <span
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center bg-accent text-on-accent transition-[clip-path] duration-300 ease-out"
        style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
      >
        {content}
      </span>
    </span>
  );
};

export const Sidebar = () => {
  const { view, setView } = useView();
  const version = useAppVersion();
  const updater = useUpdater();

  return (
    // En macOS, pt-11 deja libres los semáforos (trafficLightPosition y=17).
    <aside
      className={cn(
        "w-19 shrink-0 flex flex-col items-center gap-5 pb-4",
        isMacOS() ? "pt-11" : "pt-6",
      )}
    >
      <nav
        aria-label="Principal"
        className="flex flex-col gap-2"
      >
        {NAV.map(({ view: target, label, Icon }) => {
          const active = view === target;
          return (
            <RailButton
              key={target}
              label={label}
              active={active}
              aria-current={active ? "page" : undefined}
              onClick={() => setView(target)}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            </RailButton>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-2">
        <ThemeToggle />
        {updater.status === "available" && (
          <button
            type="button"
            onClick={() => void updater.install()}
            className={cn(
              UPDATE_PILL,
              "bg-accent text-on-accent cursor-pointer hover:opacity-90",
            )}
          >
            <span className="text-[11px] font-medium">Actualizar</span>
            <span className="text-[10px] font-mono opacity-70">
              v{updater.update?.version}
            </span>
          </button>
        )}
        {updater.status === "downloading" && (
          <UpdateProgress
            percent={updater.progress?.percent ?? 0}
            version={updater.update?.version}
          />
        )}
        {version && (
          <span
            className="font-mono text-[10px] text-muted tabular-nums"
            title="Versión de la app"
          >
            v{version}
          </span>
        )}
      </div>
    </aside>
  );
};
