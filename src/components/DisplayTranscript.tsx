import { Check, Copy, FileText, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ProcessEvent, TranscriptSegment } from "../views/transcript/AudioProcessor";
import { alertDialog, saveTextFileAs } from '../services/dialog';
import { isTauriRuntime } from '../services/runtime';
import { cn } from "../lib/utils";
import { ProgressBar } from "./ProgressBar";
import { SegmentedTabItem, SegmentedTabs, TabPanel } from "./SegmentedTabs";

type TranscriptTab = "text" | "segments";

const VIEW_TABS: SegmentedTabItem<TranscriptTab>[] = [
  { id: "text", label: "Texto" },
  { id: "segments", label: "Marcadores de tiempo" },
];

const TOOLBAR_BUTTON =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted hover:text-text hover:bg-elevated transition-colors cursor-pointer";

const ONE_HOUR_MS = 3_600_000;

const formatTime = (ms: number, withHours: boolean) => {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return withHours ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export const DisplayTranscript = ({
  text,
  segments = [],
  isProcessing,
  processStep,
  title,
}: {
  text?: string;
  segments?: TranscriptSegment[];
  isProcessing: boolean;
  processStep?: ProcessEvent | null;
  title?: string;
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TranscriptTab>("text");
  const containerRef = useRef<HTMLDivElement>(null);

  const progress = processStep?.event === "process" ? processStep : null;
  const completed =
    processStep?.event === "process_complete" ? processStep : null;
  const hasSegments = segments.length > 0;
  const showSegments = activeTab === "segments" && hasSegments;
  const showTabs = hasSegments && !isProcessing;
  const withHours = segments.some((s) => s.to_ms >= ONE_HOUR_MS);

  useEffect(() => {
    if (isProcessing && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, isProcessing]);

  const copyContent = showSegments
    ? segments
        .map(
          (s) =>
            `[${formatTime(s.from_ms, withHours)} → ${formatTime(s.to_ms, withHours)}] ${s.text}`,
        )
        .join("\n")
    : (text ?? "");

  useEffect(() => {
    if (segments && segments.length > 0) {
      setActiveTab("segments");
    }
  }, [segments]);

  const saveTranscript = async () => {
    console.log("Guardando transcripción...")
    if (!title || !copyContent) {
      console.log("No se puede guardar una transcripción sin título y texto.");
      return;
    };
    try {
      const fileName = title.replace(/\s+/g, '-').toLowerCase()
      if (isTauriRuntime()) {
        const saved = await saveTextFileAs(`${fileName}.txt`, copyContent);
        if (saved) {
          alertDialog("Transcripción guardada exitosamente.", "Éxito");
        } else {
          alertDialog("No se pudo guardar la transcripción.", "Error");
        }
      }
    } catch (error) {
      console.error(error);
    }
  };


  const content = showSegments ? (
    <ol className="flex flex-col gap-1 p-3">
      {segments.map((seg, i) => (
        <li key={i} className="flex items-baseline gap-4 px-2 py-2">
          <span className="shrink-0 text-xs font-mono tabular-nums text-muted">
            {formatTime(seg.from_ms, withHours)}
          </span>
          <p className="leading-relaxed">{seg.text}</p>
        </li>
      ))}
    </ol>
  ) : text ? (
    <p className="leading-relaxed whitespace-pre-wrap px-5 py-4">{text}</p>
  ) : (
    !isProcessing && (
      <div className="flex flex-col items-center justify-center gap-2 py-16 px-6 text-center text-muted">
        <FileText size={22} strokeWidth={1.5} aria-hidden="true" />
        <p className="text-sm">La transcripción aparecerá aquí</p>
      </div>
    )
  );

  return (
    <div
      ref={containerRef}
      className="bg-surface rounded-3xl min-h-64 max-h-80 lg:min-h-96 lg:max-h-150 overflow-y-auto"
    >
      <div className="sticky top-0 z-10 bg-surface border-b border-line px-5 py-3 flex flex-col gap-3">
        <div className="flex justify-between items-center gap-3 min-h-9">
          {isProcessing ? (
            <div role="status" className="min-w-0">
              <p className="text-sm font-medium truncate">
                {title ?? "Transcribiendo"}
              </p>
              <p className="text-xs text-muted">
                Esto puede tardar un par de minutos...
              </p>
            </div>
          ) : showTabs ? (
            <SegmentedTabs
              items={VIEW_TABS}
              value={activeTab}
              onChange={setActiveTab}
              label="Vista de la transcripción"
              idBase="transcript-view"
            />
          ) : (
            <h2 className="font-medium">Transcripción</h2>
          )}

          {(text || hasSegments) && !isProcessing && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  saveTranscript();
                }}
                className={TOOLBAR_BUTTON}
              >
                <Save size={14} strokeWidth={1.75} aria-hidden="true" />
                Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(copyContent);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={cn(
                  TOOLBAR_BUTTON,
                  copied && "text-success hover:text-success",
                )}
              >
                {copied ? (
                  <Check size={14} strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          )}
        </div>

        {progress && (
          <ProgressBar
            label={progress.step}
            value={progress.count}
            ariaLabel={`Progreso de transcripción: ${progress.step}`}
          />
        )}
        {completed && (
          <p
            role="status"
            className="flex items-center gap-1.5 text-xs text-success"
          >
            <Check size={14} strokeWidth={2} aria-hidden="true" />
            {completed.step}
          </p>
        )}
      </div>

      {showTabs ? (
        <TabPanel idBase="transcript-view" value={activeTab}>
          {content}
        </TabPanel>
      ) : (
        content
      )}
    </div>
  );
};
