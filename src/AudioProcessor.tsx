import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { CloudUpload, WandSparkles } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';

type ProcessEvent = {
  step: string;
  count?: number;
};
const models = [
  {
    name: 'ggml-tiny.bin',
    description: ' Extra rápido | menos recursos  | menos preciso | 77.7MB',
  },
  {
    name: 'ggml-small.bin',
    description: ' Mas rápido   | menos recursos  | moderado      | 488MB',
    default: true,
  },
  {
    name: 'ggml-large-v3-turbo.bin',
    description: ' Moderado     | moderado        | mas preciso   | 1.62GB',
  },
  {
    name: 'ggml-large-v3.bin',
    description: ' Más lento    | más recursos    | Ultra preciso | 3.1GB',
  },
];

export const AudioProcessor = () => {
  const [selectedFilePath, setSelectedFileFilePath] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; url: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string>('');
  const [processStep, setProcessStep] = useState<ProcessEvent | null>(null);
  const [model, setModel] = useState<string>('ggml-small.bin');

  listen<ProcessEvent>('process', (event) => {
    console.log(`processing ${event.payload.step}`);
    setProcessStep({
      step: event.payload.step,
      // count: event.payload?.count,
      ...(event.payload?.count && { count: event.payload.count }),
    });
  });

  const processAudioFile = async () => {
    console.log('processing');
    setIsProcessing(true);
    const response = await invoke('process_audio_file', {
      filePath: selectedFilePath,
      whisperModel: model,
    });
    console.log('Response:', response);
    setResult(response as string);
    setIsProcessing(false);
  };

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'opus'] }],
      });

      if (selected && typeof selected === 'string') {
        setSelectedFileFilePath(selected);
        setIsProcessing(true);

        const assetUrl = convertFileSrc(selected);
        const fileName = selected.split(/[\\/]/).pop() || 'Audio cargado';
        setFileInfo({ name: fileName, url: assetUrl });
        setIsProcessing(false);
      }
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <div className="flex flex-col justify-center items-center gap-2">
        <button
          className="border-2 border-dashed border-surface hover:text-accent transition-colors px-4 py-2 rounded-lg"
          onClick={handleSelectFile}
        >
          <div className="w-full flex flex-col justity-center items-center p-4 ">
            <CloudUpload />
            <span className="">{isProcessing ? 'Upload...' : 'Select Audio'}</span>
          </div>
        </button>
        <div>
          <label htmlFor="model">modo:</label>
          <select className="border" name="model" onChange={(e) => setModel(e.target.value)}>
            <option className='bg-slate-400'>
              VELOCIDAD | USO DE RECURSOS | PRECISIÓN | TAMAÑO
            </option>
            {models.map((model) => (
              <option key={model.name} value={model.name} selected={model.default}>
                {model.description}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="my-2">
        <figure className="w-full min-h-12">
          <figcaption className="min-h-4">{fileInfo?.name}</figcaption>
          <audio controls src={fileInfo?.url} className="w-full my-3"></audio>
          {/*<a href="fileInfo?.url"> Download audio </a>*/}
        </figure>
      </div>
      <div>
        <p>
          {processStep?.step}
          {processStep?.count && `:${processStep.count}%`}
        </p>
      </div>
      {selectedFilePath && (
        <button
          onClick={processAudioFile}
          disabled={isProcessing}
          className={isProcessing ? 'btn cursor-not-allowed' : 'btn'}
        >
          <div
            className={`w-full flex justity-center items-center text-slate-400 gap-2 ${isProcessing ? 'opacity-50 animate-pulse' : ''}`}
          >
            <WandSparkles />
            <span className="">{isProcessing ? 'Processing...' : 'Generate Transcript'}</span>
          </div>
        </button>
      )}
      <div className="max-h-80 border overflow-auto my-2 shadow-xl rounded-xl">
        {result && <div>{JSON.stringify(result)}</div>}
      </div>
      {<pre>{JSON.stringify(processStep)}</pre>}
    </div>
  );
};
