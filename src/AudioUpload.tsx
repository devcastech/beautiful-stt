import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
// import { PeaksPlayer } from './PeaksPlayer';
import { CloudUpload, WandSparkles } from 'lucide-react';

export const AudioProcessor = () => {
  const [selectedFilePath, setSelectedFileFilePath] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; url: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string>('');

  const processAudioFile = async () => {
    console.log('processing');
    setIsProcessing(true);
    const response = await invoke('process_audio_file', { filePath: selectedFilePath });
    console.log('Response:', response);
    setResult(response as string);
    setIsProcessing(false);
  };

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac'] }],
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
      <button
        className="border-2 border-dashed border-surface hover:text-accent transition-colors px-4 py-2 rounded-lg"
        onClick={handleSelectFile}
      >
        <div className="w-full flex flex-col justity-center items-center p-4 ">
          <CloudUpload />
          <span className="">{isProcessing ? 'Upload...' : 'Select Audio'}</span>
        </div>
      </button>
      {/*{fileInfo && (
        <div className='p-4'>
          <PeaksPlayer url={fileInfo.url} name={fileInfo.name} />
        </div>
      )}*/}
      <div className="my-2">
        <figure className="w-full min-h-12">
          <figcaption className="min-h-4">{fileInfo?.name}</figcaption>
          <audio controls src={fileInfo?.url} className="w-full my-3"></audio>
          {/*<a href="fileInfo?.url"> Download audio </a>*/}
        </figure>
      </div>
      <div>{result && <div>{JSON.stringify(result)}</div>}</div>
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
    </div>
  );
};
