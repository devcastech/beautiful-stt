import { useEffect, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { WandSparkles, Music, DownloadCloud, Computer } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { models } from './lib/constants';
import { DisplayTranscript } from './components/DisplayTranscript';

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
export const AudioProcessor = () => {
  const [selectedFilePath, setSelectedFileFilePath] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; url: string } | null>(null);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string>('');
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [processStep, setProcessStep] = useState<ProcessEvent | null>(null);
  const [processDownloadAssetsStep, setProcessDownloadAssetsStep] = useState<ProcessEvent | null>(null);
  const [model, setModel] = useState<string>(models[2].name);
  const [resourcesUsed, setResourcesUsed] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('localFile');

  useEffect(() => {
    const unlisten = listen<ProcessEvent>('process', (event) => {
      console.log(event);
      if (['process'].includes(event.payload.event)) {
        setProcessStep({
          event: event.payload.event,
          step: event.payload.step,
          ...(event.payload?.count != null && { count: event.payload.count }),
        });
      }
      if (['process_download_assets'].includes(event.payload.event)) {
        setProcessDownloadAssetsStep({
          event: event.payload.event,
          step: event.payload.step,
          ...(event.payload?.count != null && { count: event.payload.count }),
        });
      }
      if (event.payload.event === 'transcript_segment') {
        setResult((prev) => prev + event.payload.step);
      }
      if (event.payload.event === 'transcript_structured') {
        try {
          setSegments(JSON.parse(event.payload.step) as TranscriptSegment[]);
        } catch (e) {
          console.error('No se pudo parsear transcript_structured', e);
        }
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    async function detectGPU() {
      const response = await invoke('detect_gpu');
      setResourcesUsed(response as string);
    }
    detectGPU();
  }, []);

  const hasStartedEnsureModels  = useRef(false)
  useEffect(() => {
    if(hasStartedEnsureModels.current) return
    hasStartedEnsureModels.current = true
    async function ensureDefaultModels() {
      console.log('hasStartedEnsureModels.current', hasStartedEnsureModels.current)
      await invoke('ensure_default_models', {
        filePath: "",
        whisperModel: model,
      });
      setProcessStep(null);
      setProcessDownloadAssetsStep(null);
    }
    ensureDefaultModels();
  }, []);


  const processAudioFile = async () => {
    setIsProcessing(true);
    setResult('');
    setSegments([]);
    setProcessStep(null);
    const response = await invoke('process_audio_file', {
      filePath: selectedFilePath,
      whisperModel: model,
    });
    setResult(response as string);
    setIsProcessing(false);
  };

  const downloadAudio = async () => {
    setIsDownloading(true);
    setResult('');
    setSegments([]);
    setProcessStep(null);
    const response = await invoke('download_audio', {
      audioUrl: audioUrl,
    }) as { title: string; path: string; };
    setIsDownloading(false);
    setPreviewUnavailable(false);
    setSelectedFileFilePath(response.path);
    const assetUrl = convertFileSrc(response.path);
    setFileInfo({ name: response.title || 'Audio', url: assetUrl });
  };


  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'opus', 'm4a'] }],
      });

      if (selected && typeof selected === 'string') {
        setResult('');
        setPreviewUnavailable(false);
        setSelectedFileFilePath(selected);
        const assetUrl = convertFileSrc(selected);
        const fileName = selected.split(/[\\/]/).pop() || 'Audio';
        setFileInfo({ name: fileName, url: assetUrl });
        setProcessStep(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const SectionHeader = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3">
      <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-accent shrink-0">{label}</h2>
      <div className="h-px flex-1 bg-line" />
    </div>
  );

  return (
    <div className="w-full mx-auto px-6 lg:px-8 py-6 flex flex-col gap-6">

      {/* Transcription section */}
      <div className="flex flex-col gap-2">
        <SectionHeader label="Transcripción" />
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-2 items-start">
          <div className="flex flex-col gap-2">
            <div className="rounded-lg p-4 flex flex-col gap-3">
              <div className="p-1 flex justify-center gap-3">
                {
                  [
                    ['localFile', 'Archivo local'],
                    ['downloadFile', 'Descargar de youtube o facebook'],
                  ].map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex justify-center items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-[0.18em] px-2.5 py-1 rounded-md transition-colors ${
                            activeTab === id ? 'bg-accent/10 text-accent border border-accent' : 'text-muted hover:text-accent'
                          }`}
                      >
                        {id === 'localFile' && (
                          <Computer size={18} strokeWidth={1.25}/>
                        )}
                        {id === 'downloadFile' && (
                          <DownloadCloud size={18} strokeWidth={1.5} />
                        )}
                        <span>
                          {label}
                        </span>
                      </button>
                    ))
                }
              </div>
              {
                activeTab === 'downloadFile' && (
                  <div className='flex gap-2 flex-col justify-center items-center'>
                    <input type="text"
                      value={audioUrl}
                      onChange={(e) => setAudioUrl(e.target.value)}
                      className="group w-full bg-surface border border-line rounded-lg py-2 transition-all duration-200 p-1"
                      placeholder="https://www.youtube.com/watch?v=9oc0SrAFrMc"
                    />
                    <button
                      onClick={downloadAudio}
                      disabled={!audioUrl || isProcessing || isDownloading}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isProcessing || !audioUrl || isDownloading
                          ? 'bg-lacre/15 text-lacre cursor-not-allowed'
                          : 'bg-lacre text-bg hover:brightness-110 active:scale-[0.99]'
                      }`}
                    >
                      <DownloadCloud size={13} strokeWidth={1.5} />
                      {isDownloading ? 'Descargando...' : 'Descargar'}
                    </button>
                  </div>
                )
              }
              {
                activeTab === 'localFile' && (
                  <div>
                    <button
                      onClick={handleSelectFile}
                      className="group w-full border border-dashed border-line hover:border-accent rounded-lg py-5 transition-all duration-200"
                    >
                      <div className="flex flex-col items-center gap-2 text-muted group-hover:text-accent transition-colors duration-200">
                        <Computer size={18} strokeWidth={1.25}/>
                        <span className="font-mono text-[11px] font-medium tracking-[0.18em] uppercase">
                          {fileInfo ? 'Seleccionar otro archivo desde el equipo' : 'Seleccionar audio del equipo'}
                        </span>
                      </div>
                    </button>
                  </div>
                )
              }
              {fileInfo && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Music size={12} className="text-accent shrink-0" strokeWidth={1.5} />
                    <p className="text-base text-muted truncate">{fileInfo.name}</p>
                    <span className="font-mono text-xs uppercase tracking-wider text-accent border border-line rounded px-1.5 py-0.5 shrink-0">
                      {selectedFilePath?.split('.').pop()}
                    </span>
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
              <div className="flex flex-col gap-1.5">
                <label htmlFor="whisper-model" className="font-mono text-[10px] text-accent uppercase tracking-[0.18em]">Modelo</label>
                <select
                  id="whisper-model"
                  className="w-full px-3 py-2 rounded-lg border border-line hover:border-accent/50 focus:border-accent bg-bg outline-none text-sm transition-colors"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {models.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.label} - {m.description}
                    </option>
                  ))}
                </select>
              </div>
              {selectedFilePath && (
                <button
                  onClick={processAudioFile}
                  disabled={isProcessing}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isProcessing
                      ? 'bg-lacre/15 text-lacre cursor-not-allowed'
                      : 'bg-lacre text-bg hover:brightness-110 active:scale-[0.99]'
                  }`}
                >
                  <WandSparkles size={13} strokeWidth={1.5} />
                  {isProcessing ? 'Procesando...' : 'Transcribir'}
                </button>
              )}
            </div>
            <div className="flex justify-center items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-surface border border-line text-muted">
                {model.replace('.bin', '')}
              </span>
              {resourcesUsed && (
                <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-surface border border-line text-muted">
                  {resourcesUsed}
                </span>
              )}
            </div>
          </div>

          <DisplayTranscript text={result} segments={segments} isProcessing={isProcessing} processStep={processStep} title={fileInfo?.name} />
        </div>
        {
          processDownloadAssetsStep && (
            <div className="flex flex-col gap-1 mt-2">
              <div className="flex justify-between text-xs text-muted">
                <span className="truncate">{processDownloadAssetsStep.step}</span>
                {processDownloadAssetsStep.count != null && (
                  <span className="shrink-0 ml-2">{processDownloadAssetsStep.count}%</span>
                )}
              </div>
              <div
                role="processDownloadAssetsStepbar"
                aria-label={`Progreso de descarga de assets: ${processDownloadAssetsStep.step}`}
                aria-valuemin={0}
                aria-valuemax={100}
                {...(processDownloadAssetsStep.count != null && {
                  "aria-valuenow": processDownloadAssetsStep.count,
                })}
                className="w-full h-0.5 rounded-full bg-line overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                  style={{
                    width: `${processDownloadAssetsStep.count != null ? processDownloadAssetsStep.count : 100}%`,
                  }}
                />
              </div>
            </div>
          )
  }
      </div>
    </div>
  );
};
