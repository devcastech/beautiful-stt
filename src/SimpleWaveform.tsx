import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, RotateCcw, RotateCw } from 'lucide-react';

export const AudioPlayer = ({ url, name }: { url: string; name: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState('00:00');
  const [duration, setDuration] = useState('00:00');
  const [error, setError] = useState<string | null>(null);

  // Formateador de tiempo (00:00)
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!containerRef.current || waveSurferRef.current) return;

    // Crear elemento audio para forzar uso de HTML5 Audio en lugar de Web Audio API
    const audio = new Audio();
    audio.src = url;
    audio.crossOrigin = 'anonymous';

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4b5563',
      progressColor: '#6366f1',
      media: audio,
      height: 60,
      barWidth: 1,
      barGap: 3,
      normalize: true,
    });

    ws.on('ready', () => {
      setError(null);
      setDuration(formatTime(ws.getDuration()));
    });
    ws.on('timeupdate', () => setCurrentTime(formatTime(ws.getCurrentTime())));
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('error', (err: unknown) => {
      let errorMsg = 'Unknown error';
      if (err instanceof MediaError) {
        const codes: Record<number, string> = {
          1: 'MEDIA_ERR_ABORTED - Carga abortada',
          2: 'MEDIA_ERR_NETWORK - Error de red',
          3: 'MEDIA_ERR_DECODE - Error de decodificación',
          4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - Formato no soportado o archivo no accesible',
        };
        errorMsg = codes[err.code] || `MediaError code: ${err.code}`;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }
      setError(`${errorMsg} - URL: ${url}`);
    });

    waveSurferRef.current = ws;
    return () => {
      ws.destroy();
      waveSurferRef.current = null;
    };
  }, [url]);

  const togglePlay = () => waveSurferRef.current?.playPause();
  const skip = (seconds: number) => {
    const ws = waveSurferRef.current;
    if (ws) ws.setTime(ws.getCurrentTime() + seconds);
  };

  return (
    <div className="bg-surface text-text p-4 rounded-xl shadow-2xl max-w-4xl mx-auto">
      <div className="text-xs text-muted">
        <span>{name}</span>
      </div>
      <div ref={containerRef} className="mb-4 h-[60px] overflow-hidden" />
      {error && <div className="text-red-500 text-xs mb-2">{error}</div>}

      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-mono text-muted w-12">{currentTime}</span>

        <div className="flex items-center gap-6">
          <button
            onClick={() => skip(-10)}
            className="hover:text-accent flex items-center transition-colors gap-2"
          >
            <span className="text-[9px]">-10</span>
            <RotateCcw size={20} />
          </button>

          <button
            onClick={togglePlay}
            className="bg-accent text-white p-3 rounded-full transition-all transform active:scale-95"
          >
            {isPlaying ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" className="ml-1" />
            )}
          </button>

          <button
            onClick={() => skip(10)}
            className="hover:text-accent flex items-center transition-colors gap-2"
          >
            <RotateCw size={20} />
            <span className="text-[9px]">+10</span>
          </button>
        </div>

        <span className="text-xs font-mono text-muted w-12 text-right">{duration}</span>
      </div>
    </div>
  );
};
