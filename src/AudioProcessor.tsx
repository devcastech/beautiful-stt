import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { CloudUpload, WandSparkles, Music, Copy, Check } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';

type ProcessEvent = {
  step: string;
  count?: number;
};

const models = [
  {
    name: 'ggml-tiny.bin',
    label: 'Tiny',
    description: 'Extra rápido · menos preciso · 77.7MB',
  },
  {
    name: 'ggml-small.bin',
    label: 'Small',
    description: 'Rápido · moderado · 488MB',
    default: true,
  },
  {
    name: 'ggml-medium-q8_0.bin',
    label: 'Medium',
    description: 'Moderado · moderado · 823MB',
  },  
  {
    name: 'ggml-large-v3-turbo.bin',
    label: 'Large Turbo',
    description: 'Moderado · más preciso · 1.62GB',
  },
  {
    name: 'ggml-large-v3.bin',
    label: 'Large v3',
    description: 'Lento · ultra preciso · 3.1GB',
  },
];

export const AudioProcessor = () => {
  const [selectedFilePath, setSelectedFileFilePath] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; url: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string>('h bueno miñito gracias a dios que están aliviaditos bendito sea dios  no hay si mi amor es cierto oiga con esta vida que se pelotan no tarde tan fría mejor dicho  soy sanito en la casita toca no miñito pues que es que  alejandra le coja a su paparrato que vienen dos muchachos a mirarlo a las 5  y el dice que yo estaba arriba y que es que faltando 15 para las 5  vinieron de un muchacho y pararon afuera que el pronto el uno le dijo al otro que pionan a  ver si que la pierden que se fueron para el frente tomas en la y claro y como dice ser  de su papá que iba a entrar gente lloviznando que más que caro mirando hacia un momentico  después vinieron y pagaron y no quiero nada dice que pronto eran esos no hay vamos mitos  a que cale tiempo al tiempo no hay de otro andito dios pues ahí van dice que ha estado entrenando  un muchacho que así no hay más remedio ya está manás ya le dijimos que le guiara entonces  si quería venir a trajanos unos días el que va a venir hoy pero van o sea las dos me habló yo no  mira el mensaje además que me habla digo que ni a hoy o mañana con él vamos a ver si está disponible  y los muchachos a salvo a ver que vamos a ser mito mientras tanto toca la mano del señor pero yo sé  que si ellos quieren lo vendemos mi amor con la ayuda del señor la virgencita estoy pidiendo la san  antonito que la ha sido muy milagroso siempre intercede por uno cuando no tiene algo que le  pide urgente si dios quiere así será');
  const [processStep, setProcessStep] = useState<ProcessEvent | null>(null);
  const [model, setModel] = useState<string>('ggml-small.bin');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unlisten = listen<ProcessEvent>('process', (event) => {
      setProcessStep({
        step: event.payload.step,
        ...(event.payload?.count != null && { count: event.payload.count }),
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
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
        setResult("")
        setSelectedFileFilePath(selected);
        const assetUrl = convertFileSrc(selected);
        const fileName = selected.split(/[\\/]/).pop() || 'Audio';
        setFileInfo({ name: fileName, url: assetUrl });
        setResult('');
        setProcessStep(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-6 flex flex-col gap-5">
      {/* Upload area */}
      <button
        onClick={handleSelectFile}
        className="group w-full border border-dashed border-[var(--color-muted)] hover:border-[var(--color-accent)] rounded-xl py-8 transition-all duration-300"
      >
        <div className="flex flex-col items-center gap-2 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors">
          <CloudUpload size={28} strokeWidth={1.5} />
          <span className="text-sm font-medium">
            {fileInfo ? 'Cambiar audio' : 'Seleccionar audio'}
          </span>
        </div>
      </button>

      {/* File info + player */}
      {fileInfo && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface)]">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
            <Music size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileInfo.name}</p>
            <audio controls src={fileInfo.url} className="w-full h-8 mt-1" />
          </div>
        </div>
      )}

      {/* Model selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider">Modelo</label>
        <select
          className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-transparent focus:border-[var(--color-accent)] outline-none text-sm transition-colors"
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

      {/* Process button */}
      {selectedFilePath && (
        <button
          onClick={processAudioFile}
          disabled={isProcessing}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm text-white transition-all duration-300 ${
            isProcessing
              ? 'bg-[var(--color-muted)] cursor-not-allowed'
              : 'bg-[var(--color-accent)] hover:opacity-90 active:scale-[0.98]'
          }`}
        >
          <WandSparkles size={16} />
          {isProcessing ? 'Procesando...' : 'Transcribir'}
        </button>
      )}

      {/* Progress */}
      {processStep && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs text-[var(--color-muted)]">
            <span>{processStep.step}</span>
            {processStep.count != null && <span>{processStep.count}%</span>}
          </div>
          <div className="w-full h-1.5 rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500 ease-out"
              style={{ width: `${processStep.count != null ? processStep.count: 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl bg-[var(--color-surface)] p-4 max-h-64 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-[var(--color-muted)] uppercase tracking-wider">Transcripción</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(result);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{result}</p>
        </div>
      )}
    </div>
  );
};
