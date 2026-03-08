import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { CloudUpload, WandSparkles, Music, Sparkles } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { llmModels, models } from './lib/constants';
import { DisplayTranscript } from './components/DisplayTranscript';
import { DisplaySummary } from './components/DisplaySummary';

type ProcessEvent = {
  event: string;
  step: string;
  count?: number;
};

export const AudioProcessor = () => {
  const [selectedFilePath, setSelectedFileFilePath] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; url: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string>('');
  const [processStep, setProcessStep] = useState<ProcessEvent | null>(null);
  const [model, setModel] = useState<string>(models[1].name);
  const [resourcesUsed, setResourcesUsed] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [llmModel, setLlmModel] = useState<string>(llmModels[0].name);
  const [outputMode, setOutputMode] = useState<'summary' | 'detailed'>('summary');

  useEffect(() => {
    const unlisten = listen<ProcessEvent>('process', (event) => {
      console.log(event);
      if (['process', 'summary_progress'].includes(event.payload.event)) {
        setProcessStep({
          event: event.payload.event,
          step: event.payload.step,
          ...(event.payload?.count != null && { count: event.payload.count }),
        });
      }
      if (event.payload.event === 'transcript_segment') {
        setResult((prev) => prev + event.payload.step);
      }
      if (event.payload.event === 'summary_segment') {
        setSummary((prev) => prev + event.payload.step);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    async function detectGPU() {
      const response = await invoke('detect_gpu', {
        filePath: selectedFilePath,
        whisperModel: model,
      });
      setResourcesUsed(response as string);
    }
    detectGPU();
  }, []);

  const processAudioFile = async () => {
    setIsProcessing(true);
    setSummary('');
    setResult('');
    setProcessStep(null);
    const response = await invoke('process_audio_file', {
      filePath: selectedFilePath,
      whisperModel: model,
    });
    setResult(response as string);
    setIsProcessing(false);
  };

  const handleSummarize = async () => {
    if (!result) return;

    setIsSummarizing(true);
    setSummary('');
    setProcessStep(null);

    try {
      const response = await invoke('summarize_transcript', {
        transcript: result,
        llmModel: llmModel,
        outputMode: outputMode,
      });
      console.log('RESUMEN', response);
      setSummary(response as string);
    } catch (error) {
      console.error('Error al resumir:', error);
      setSummary('Error al generar el resumen: ' + error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'opus'] }],
      });

      if (selected && typeof selected === 'string') {
        setResult('');
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

  return (
    <div className="w-full max-w-4xl lg:max-w-full mx-auto px-8 py-6 flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* Left column — controls */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">

          {/* Upload zone */}
          <button
            onClick={handleSelectFile}
            className="group w-full border border-line hover:border-text rounded py-8 transition-all duration-200"
          >
            <div className="flex flex-col items-center gap-2 text-muted group-hover:text-text transition-colors duration-200">
              <CloudUpload size={20} strokeWidth={1.25} />
              <span className="text-xs font-medium tracking-widest uppercase">
                {fileInfo ? 'Cambiar archivo' : 'Seleccionar audio'}
              </span>
            </div>
          </button>

          {/* File info */}
          {fileInfo && (
            <div className="flex flex-col gap-2 pb-1">
              <div className="flex items-center gap-2">
                <Music size={12} className="text-muted shrink-0" strokeWidth={1.5} />
                <p className="text-xs text-muted truncate">{fileInfo.name}</p>
              </div>
              <audio controls src={fileInfo.url} className="w-full h-8" />
            </div>
          )}

          {/* Transcription model */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted uppercase tracking-widest">Modelo</label>
            <select
              className="w-full px-3 py-2 rounded border border-line hover:border-text focus:border-text bg-bg outline-none text-sm transition-colors"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.label} — {m.description}
                </option>
              ))}
            </select>
          </div>

          {/* Transcribe button */}
          {selectedFilePath && (
            <button
              onClick={processAudioFile}
              disabled={isProcessing}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded text-sm font-medium transition-all duration-200 ${
                isProcessing
                  ? 'bg-text text-bg opacity-40 cursor-not-allowed'
                  : 'bg-text text-bg hover:opacity-80 active:scale-[0.99]'
              }`}
            >
              <WandSparkles size={13} strokeWidth={1.5} />
              {isProcessing ? 'Procesando...' : 'Transcribir'}
            </button>
          )}

          {/* Progress bar */}
          {processStep && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-muted">
                <span>{processStep.step}</span>
                {processStep.count != null && <span>{processStep.count}%</span>}
              </div>
              <div className="w-full h-px bg-line overflow-hidden">
                <div
                  className="h-full bg-text transition-all duration-500 ease-out"
                  style={{ width: `${processStep.count != null ? processStep.count : 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Resource info */}
          <div className="flex items-center gap-2 mt-auto pt-2">
            <span className="text-xs font-mono text-muted">{model.replace('.bin', '')}</span>
            {resourcesUsed && (
              <>
                <span className="text-muted text-xs">·</span>
                <span className="text-xs font-mono text-muted">{resourcesUsed}</span>
              </>
            )}
          </div>
        </div>

        {/* Transcript panel */}
        <div className="w-full min-w-0">
          <DisplayTranscript text={result} isProcessing={isProcessing} />
        </div>

        {/* Summary panel */}
        {summary && (
          <div className="w-full min-w-0">
            <DisplaySummary text={summary} isGenerating={isSummarizing} />
          </div>
        )}
      </div>

      {/* Post-transcript controls */}
      {result && !isProcessing && (
        <div className="flex flex-col lg:flex-row gap-4 border-t border-line pt-5">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs text-muted uppercase tracking-widest">Modelo de resumen</label>
            <select
              className="w-full px-3 py-2 rounded border border-line hover:border-text focus:border-text bg-bg outline-none text-sm transition-colors"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
            >
              {llmModels.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.label} — {m.description}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs text-muted uppercase tracking-widest">Tipo de salida</label>
            <select
              className="w-full px-3 py-2 rounded border border-line hover:border-text focus:border-text bg-bg outline-none text-sm transition-colors"
              value={outputMode}
              onChange={(e) => setOutputMode(e.target.value as 'summary' | 'detailed')}
            >
              <option value="summary">Resumen — Idea general de qué trata el audio</option>
              <option value="detailed">Detallado — Resumen + valores, fechas y datos clave ⚠️ requiere buen hardware</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleSummarize}
              disabled={isSummarizing}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded text-sm font-medium border transition-all duration-200 ${
                isSummarizing
                  ? 'border-line text-muted cursor-not-allowed'
                  : 'border-text text-text hover:bg-text hover:text-bg active:scale-[0.99]'
              }`}
            >
              <Sparkles size={12} strokeWidth={1.5} />
              {isSummarizing ? 'Generando...' : outputMode === 'detailed' ? 'Resumen detallado' : 'Resumir'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
