import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import {
  DownloadCloud,
  Music,
  Computer,
  Link,
  Plus,
  CloudDownload,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { DisplayTranscript } from "../../components/DisplayTranscript";
import { Page } from "../../components/Page";
import { getModelList, ModelInfo } from "../../services/getModels";
import { Select } from "../../components/Select";
import {
  SegmentedTabItem,
  SegmentedTabs,
  TabPanel,
} from "../../components/SegmentedTabs";
import { ProgressBar } from "../../components/ProgressBar";
import { VIEWS, useView } from "../../hooks/useView";
import { cn, formatBytes } from "../../lib/utils";
import { DownloadSteps } from "./components/DownloadSteps";
import { TranscriptionParamsCard } from "./components/TranscriptionParamsCard";
import {
  TranscriptionParams,
  getTranscriptionParams,
  transcribeAudio,
} from "../../services/transcription";

export type ProcessEvent = {
  event: string;
  step: string;
  count?: number;
};

export type TranscriptSegment = {
  from_ms: number;
  to_ms: number;
  text: string;
};

type SourceTab = "localFile" | "downloadFile";

const SOURCE_TABS: SegmentedTabItem<SourceTab>[] = [
  { id: "localFile", label: "Archivo local", icon: Computer },
  { id: "downloadFile", label: "Desde URL", icon: Link },
];


export const AudioProcessor = () => {
  const { view } = useView();
  const [selectedFilePath, setSelectedFileFilePath] = useState<string | null>(
    null,
  );
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string>("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [processStep, setProcessStep] = useState<ProcessEvent | null>(null);
  const [processDownloadAssetsStep, setProcessDownloadAssetsStep] =
    useState<ProcessEvent | null>(null);
  const [model, setModel] = useState<string>("");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [params, setParams] = useState<TranscriptionParams | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<SourceTab>("localFile");
  const [startingApp, setStartingApp] = useState<boolean>(false);

  const refreshModels = useCallback(() => {
    getModelList()
      .then((list) => {
        setModels(list);
        setModel(
          (current) =>
            current || (list.find((m) => m.default) ?? list[0])?.name || "",
        );
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (view === VIEWS.transcript) refreshModels();
  }, [view, refreshModels]);

  useEffect(() => {
    const unlisten = listen<ProcessEvent>("process", (event) => {
      console.log(event);
      if (
        ["process", "process_complete"].includes(event.payload.event) &&
        event.payload.step
      ) {
        setProcessStep({
          event: event.payload.event,
          step: event.payload.step,
          ...(event.payload?.count != null && { count: event.payload.count }),
        });
      }
      if (["process_download_assets"].includes(event.payload.event)) {
        setProcessDownloadAssetsStep({
          event: event.payload.event,
          step: event.payload.step,
          ...(event.payload?.count != null && { count: event.payload.count }),
        });
      }
      if (event.payload.event === "transcript_reset") {
        setResult("");
        setSegments([]);
      }
      if (event.payload.event === "transcript_segment") {
        setResult((prev) => prev + event.payload.step);
      }
      if (event.payload.event === "transcript_structured") {
        try {
          setSegments(JSON.parse(event.payload.step) as TranscriptSegment[]);
        } catch (e) {
          console.error("No se pudo parsear transcript_structured", e);
        }
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (view !== VIEWS.transcript || !model) return;
    getTranscriptionParams(model).then(setParams).catch(console.error);
  }, [view, model]);

  const hasStartedEnsureModels = useRef(false);
  useEffect(() => {
    if (!model) return;
    if (hasStartedEnsureModels.current) return;
    hasStartedEnsureModels.current = true;
    async function ensureDefaultModels() {
      console.log(
        "hasStartedEnsureModels.current",
        hasStartedEnsureModels.current,
      );
      setStartingApp(true);
      const response = await invoke("ensure_default_models", {
        filePath: "",
        whisperModel: model,
      });
      console.log("response", response);
      setStartingApp(false);
      if (response !== "Success") {
        alert("problema iniciando");
      }
      setProcessStep(null);
      setProcessDownloadAssetsStep(null);
      refreshModels();
    }
    ensureDefaultModels();
  }, [model, refreshModels]);

  const processAudioFile = async () => {
    if (!selectedFilePath) return;
    setIsProcessing(true);
    setResult("");
    setSegments([]);
    setProcessStep(null);
    setProcessDownloadAssetsStep(null);
    const output = await transcribeAudio(selectedFilePath, model);
    setResult(output.text);
    if (output.params) setParams(output.params);
    setIsProcessing(false);
    refreshModels();
  };

  const downloadAudio = async () => {
    setIsDownloading(true);
    setResult("");
    setSegments([]);
    setProcessStep(null);
    const response = (await invoke("download_audio", {
      audioUrl: audioUrl,
    })) as { title: string; path: string };
    setIsDownloading(false);
    setPreviewUnavailable(false);
    setSelectedFileFilePath(response.path);
    const assetUrl = convertFileSrc(response.path);
    setFileInfo({ name: response.title || "Audio", url: assetUrl });
  };

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Audio",
            extensions: ["mp3", "wav", "ogg", "flac", "aac", "opus", "m4a"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        setResult("");
        setSegments([]);
        setPreviewUnavailable(false);
        setSelectedFileFilePath(selected);
        const assetUrl = convertFileSrc(selected);
        const fileName = selected.split(/[\\/]/).pop() || "Audio";
        setFileInfo({ name: fileName, url: assetUrl });
        setProcessStep(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (startingApp) {
    return (
      <Page title="Transcripción">
        <div className="max-w-lg bg-surface rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="font-medium">Preparando todo</p>
            <p className="text-sm text-muted">
              Se están realizando las configuraciones iniciales, esto tomará
              solo un momento.
            </p>
          </div>
          {processDownloadAssetsStep ? (
            <DownloadSteps
              processDownloadAssetsStep={processDownloadAssetsStep}
            />
          ) : (
            <ProgressBar ariaLabel="Configuración inicial" />
          )}
        </div>
      </Page>
    );
  }

  return (
    <Page title="Transcripción">
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
        <div className="flex flex-col gap-4">
          <section
            aria-label="Audio"
            className="bg-surface rounded-3xl p-5 flex flex-col gap-4"
          >
            <SegmentedTabs
              items={SOURCE_TABS}
              value={activeTab}
              onChange={setActiveTab}
              label="Origen del audio"
              idBase="audio-source"
              fullWidth
            />

            <TabPanel idBase="audio-source" value={activeTab}>
              {activeTab === "localFile" && (
                <button
                  type="button"
                  onClick={handleSelectFile}
                  className="group w-full flex flex-col items-center gap-2 py-6 rounded-2xl border-2 border-dashed border-line hover:border-muted text-muted hover:text-text transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-elevated group-hover:bg-accent group-hover:text-on-accent transition-colors">
                    <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span className="text-sm">
                    {fileInfo
                      ? "Seleccionar otro archivo"
                      : "Seleccionar audio del equipo"}
                  </span>
                  <span className="text-xs text-muted">
                    MP3, WAV, OGG, FLAC, AAC, OPUS, M4A
                  </span>
                </button>
              )}

              {activeTab === "downloadFile" && (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="audio-url"
                    className="text-xs font-medium text-muted"
                  >
                    Enlace de YouTube o Facebook
                  </label>
                  <input
                    id="audio-url"
                    type="url"
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    className="w-full bg-elevated rounded-full px-4 py-2.5 text-sm border border-transparent focus:border-accent/40 placeholder:text-muted/70 transition-colors"
                    placeholder="https://www.youtube.com/watch?v=9oc0SrAFrMc"
                  />
                  <button
                    type="button"
                    onClick={downloadAudio}
                    disabled={!audioUrl || isProcessing || isDownloading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-medium bg-elevated text-text transition-colors enabled:hover:bg-line disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <DownloadCloud size={14} strokeWidth={1.75} aria-hidden="true" />
                    {isDownloading ? "Descargando..." : "Descargar audio"}
                  </button>
                </div>
              )}
            </TabPanel>

            {fileInfo && (
              <div className="flex flex-col gap-3 rounded-2xl bg-elevated p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Music
                    size={18}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="shrink-0 text-muted"
                  />
                  <p className="flex-1 text-sm truncate" title={fileInfo.name}>
                    {fileInfo.name}
                  </p>
                </div>
                {!previewUnavailable && (
                  <audio
                    controls
                    preload="metadata"
                    src={fileInfo.url}
                    aria-label={`Vista previa de ${fileInfo.name}`}
                    className="w-full h-8"
                    onError={() => setPreviewUnavailable(true)}
                  />
                )}
              </div>
            )}
          </section>

          <section
            aria-label="Modelo y transcripción"
            className="bg-surface rounded-3xl p-5 flex flex-col gap-4"
          >
            <Select
              label="Modelo"
              value={model}
              onChange={setModel}
              options={models.map((m) => ({
                value: m.name,
                label: m.label,
                meta: formatBytes(m.disk_size ?? m.size),
                description: m.description,
                trailing: m.downloaded ? undefined : (
                  <>
                    <CloudDownload
                      size={14}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="sr-only">Se descargará al transcribir</span>
                  </>
                ),
              }))}
            />

            {isProcessing && processDownloadAssetsStep && (
              <DownloadSteps
                processDownloadAssetsStep={processDownloadAssetsStep}
              />
            )}

            {selectedFilePath && (
              <button
                type="button"
                onClick={processAudioFile}
                disabled={isProcessing}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-medium bg-accent text-on-accent transition-all",
                  isProcessing
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:opacity-90 active:scale-[0.99] cursor-pointer",
                )}
              >
                {isProcessing ? "Procesando..." : "Transcribir"}
              </button>
            )}
          </section>

          <TranscriptionParamsCard params={params} />
        </div>

        <DisplayTranscript
          text={result}
          segments={segments}
          isProcessing={isProcessing}
          processStep={processStep}
          title={fileInfo?.name}
        />
      </div>
    </Page>
  );
};
