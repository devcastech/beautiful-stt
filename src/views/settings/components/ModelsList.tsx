import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Check, CloudDownload, LoaderCircle, Trash2 } from "lucide-react";
import { ModelInfo } from "../../../services/getModels";
import { deleteModel } from "../../../services/deleteModel";
import { downloadModel } from "../../../services/downloadModel";
import { alertDialog } from "../../../services/dialog";
import { ProgressBar } from "../../../components/ProgressBar";
import { cn, formatBytes } from "../../../lib/utils";
import type { ProcessEvent } from "../../transcript/AudioProcessor";

const dateFormatter = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
});

const parseDate = (seconds: number | null) =>
  seconds == null ? "—" : dateFormatter.format(new Date(seconds * 1000));

type Pending ={ name: string; kind: "download" | "delete" } | null;

const ICON_BUTTON =
  "inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-elevated text-muted transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

export const ModelsList = ({
  models,
  onRefresh,
}: {
  models: ModelInfo[];
  onRefresh: () => void;
}) => {
  const [pending, setPending] = useState<Pending>(null);
  const [progress, setProgress] = useState<ProcessEvent | null>(null);
  const [justDownloaded, setJustDownloaded] = useState<string | null>(null);
  const isDownloading = pending?.kind === "download";

  useEffect(() => {
    if (!isDownloading) return;
    const unlisten = listen<ProcessEvent>("process", (event) => {
      if (event.payload.event === "process_download_assets") {
        setProgress(event.payload);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [isDownloading]);

  const removeModel = async (name: string) => {
    setPending({ name, kind: "delete" });
    try {
      await deleteModel(name);
    } catch (error) {
      console.error(error);
      void alertDialog(String(error), "No se pudo borrar el modelo", "error");
    } finally {
      setPending(null);
      onRefresh();
    }
  };

  const fetchModel = async (name: string) => {
    setPending({ name, kind: "download" });
    setProgress(null);
    try {
      const response = await downloadModel(name);
      if (response === "Success") {
        setJustDownloaded(name);
        setTimeout(() => setJustDownloaded(null), 3000);
      } else {
        void alertDialog(response, "No se pudo descargar el modelo", "error");
      }
    } catch (error) {
      console.error(error);
      void alertDialog(String(error), "No se pudo descargar el modelo", "error");
    } finally {
      setPending(null);
      setProgress(null);
      onRefresh();
    }
  };

  if (models.length === 0) {
    return (
      <p className="bg-surface rounded-3xl px-6 py-12 text-center text-sm text-muted">
        No hay modelos disponibles
      </p>
    );
  }

  return (
    <ul
      aria-label="Modelos de transcripción"
      className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3"
    >
      {models.map((model) => {
        const isPending = pending?.name === model.name;
        const downloadingThis = isPending && pending?.kind === "download";

        return (
          <li
            key={model.name}
            aria-busy={isPending || undefined}
            className={cn(
              "rounded-2xl border bg-surface p-4 flex flex-col gap-3",
              model.downloaded ? "border-line" : "border-dashed border-line",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-medium">{model.label}</h2>
                  <span className="text-xs text-muted tabular-nums">
                    {formatBytes(model.disk_size ?? model.size)}
                  </span>
                </div>
                <p className="text-sm text-muted">{model.description}</p>
              </div>

              {model.downloaded ? (
                <button
                  type="button"
                  onClick={() => removeModel(model.name)}
                  disabled={pending !== null}
                  aria-label={`Borrar ${model.label}`}
                  title="Borrar"
                  className={cn(ICON_BUTTON, "enabled:hover:text-danger")}
                >
                  {isPending ? (
                    <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fetchModel(model.name)}
                  disabled={pending !== null}
                  aria-label={`Descargar ${model.label}`}
                  title="Descargar"
                  className={cn(
                    ICON_BUTTON,
                    "enabled:hover:bg-accent enabled:hover:text-on-accent",
                  )}
                >
                  {isPending ? (
                    <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <CloudDownload size={16} strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
              )}
            </div>

            {downloadingThis && (
              <ProgressBar
                label={progress?.step ?? "Preparando descarga..."}
                value={progress?.count}
                ariaLabel={`Descargando ${model.label}`}
              />
            )}

            <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-line text-xs text-muted">
              <span className="font-mono truncate" title={model.name}>
                {model.name}
              </span>
              {model.downloaded && (
                <span
                  className={cn(
                    "shrink-0 flex items-center gap-1 tabular-nums transition-colors",
                    justDownloaded === model.name && "text-success",
                  )}
                >
                  {justDownloaded === model.name && (
                    <Check size={12} strokeWidth={2} aria-hidden="true" />
                  )}
                  Descargado el {parseDate(model.modified ?? null)}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
