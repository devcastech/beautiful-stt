import { useEffect, useRef, useState } from 'react';
import Peaks, { PeaksInstance } from 'peaks.js';
import { Play, Pause, RotateCcw, RotateCw } from 'lucide-react';

export const PeaksPlayer = ({ url, name }: { url: string; name: string }) => {
  const zoomviewRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const peaksRef = useRef<PeaksInstance | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState('00:00');
  const [duration, setDuration] = useState('00:00');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!zoomviewRef.current || !audioRef.current || peaksRef.current) return;

    const audioElement = audioRef.current;
    let cancelled = false;

    const initPeaks = async () => {
      try {
        // Cargar el audio manualmente
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        if (cancelled) return;

        // Decodificar el audio
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (cancelled) {
          await audioContext.close();
          return;
        }

        // Configurar el elemento audio para reproducción
        audioElement.src = url;

        const options: Parameters<typeof Peaks.init>[0] = {
          zoomview: {
            container: zoomviewRef.current!,
            waveformColor: '#6366f1',
            playedWaveformColor: '#a5b4fc',
          },
          mediaElement: audioElement,
          webAudio: {
            audioContext: audioContext,
            audioBuffer: audioBuffer,
          },
        };

        Peaks.init(options, (err, peaks) => {
          if (cancelled) {
            peaks?.destroy();
            return;
          }

          if (err) {
            setError(err.message);
            setIsLoading(false);
            return;
          }

          if (peaks) {
            peaksRef.current = peaks;
            setIsLoading(false);
            setDuration(formatTime(audioBuffer.duration));
          }
        });

      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      }
    };

    initPeaks();

    const handleTimeUpdate = () => {
      setCurrentTime(formatTime(audioElement.currentTime));
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);

    return () => {
      cancelled = true;
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);

      if (peaksRef.current) {
        peaksRef.current.destroy();
        peaksRef.current = null;
      }
    };
  }, [url]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime += seconds;
    }
  };

  return (
    <div className="bg-surface text-text p-4 rounded-xl shadow-2xl max-w-4xl mx-auto">
      <div className="text-xs text-muted">
        <span>{name}</span>
      </div>

      <audio ref={audioRef} hidden />
      <div ref={zoomviewRef} className="mb-4 h-[60px]" />

      {isLoading && <div className="text-xs text-muted mb-2">Loading waveform...</div>}
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
            disabled={isLoading}
            className="bg-accent text-white p-3 rounded-full transition-all transform active:scale-95 disabled:opacity-50"
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
