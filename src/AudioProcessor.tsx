import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { CloudUpload, WandSparkles, Music } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { models } from './lib/constants';
import { DisplayTranscript } from './components/DisplayTranscript';

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
  const [model, setModel] = useState<string>('ggml-small.bin');
  const [resourcesUsed, setResourcesUsed] = useState<string>('');

  useEffect(() => {
    const unlisten = listen<ProcessEvent>('process', (event) => {
      console.log(event);
      if (event.payload.event === 'process') {
        setProcessStep({
          event: event.payload.event,
          step: event.payload.step,
          ...(event.payload?.count != null && { count: event.payload.count }),
        });
      }
      if (event.payload.event === 'transcript_segment') {
        setResult((prev) => prev + event.payload.step);
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
    setResult('');
    setProcessStep(null);
    const response = await invoke('process_audio_file', {
      filePath: selectedFilePath,
      whisperModel: model,
    });
    setResult(response as string);
    setIsProcessing(false);
    // setProcessStep(null);
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
    <div className="w-full max-w-4xl lg:max-w-full mx-auto px-6 lg:px-10 py-4 flex flex-col gap-2">
      <div className="flex flex-col lg:flex-row justify-center items-center lg:items-start gap-4">
        <div className="w-full max-w-lg flex flex-col gap-4">
          <button
            onClick={handleSelectFile}
            className="group w-full border border-dashed border-muted hover:border-accent rounded-xl py-2 transition-all duration-300"
          >
            <div className="flex flex-col items-center gap-2 text-muted group-hover:text-accent transition-colors">
              <CloudUpload size={28} strokeWidth={1.5} />
              <span className="text-sm font-medium">
                {fileInfo ? 'Seleccionar otro' : 'Seleccionar audio'}
              </span>
            </div>
          </button>
          {fileInfo && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Music size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fileInfo.name}</p>
                <audio controls src={fileInfo.url} className="w-full h-8 mt-1" />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted uppercase tracking-wider">Modelo</label>
            <select
              className="w-full px-3 py-2 rounded-lg bg-surface border border-transparent focus:border-accent outline-none text-sm transition-colors"
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

          {selectedFilePath && (
            <button
              onClick={processAudioFile}
              disabled={isProcessing}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm text-white transition-all duration-300 ${
                isProcessing
                  ? 'bg-accent cursor-not-allowed animate-pulse'
                  : 'bg-accent hover:opacity-90 active:scale-[0.98]'
              }`}
            >
              <WandSparkles size={16} />
              {isProcessing ? 'Procesando...' : 'Transcribir'}
            </button>
          )}
          {processStep && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-muted">
                <span>{processStep.step}</span>
                {processStep.count != null && <span>{processStep.count}%</span>}
              </div>
              <div className="w-full h-1.5 rounded-full bg-surface overflow-auto">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                  style={{ width: `${processStep.count != null ? processStep.count : 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="w-full rounded-lg relative">
          <DisplayTranscript text={result} isProcessing={isProcessing} />
        </div>
      </div>
      <div className="w-full flex justify-center items-center gap-2 border-t border-surface pt-2">
        <p className="text-xs font-mono border border-surface text-muted p-1 rounded">
          {model.replace('.bin', '')}
        </p>
        <p className="text-xs font-mono border border-surface  text-muted p-1 rounded">
          {resourcesUsed}
        </p>
      </div>
    </div>
  );
};
