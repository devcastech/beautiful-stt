import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ProcessEvent, TranscriptSegment } from '../AudioProcessor';

const formatTime = (ms: number) => {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

export const DisplayTranscript = ({
  text,
  segments = [],
  isProcessing,
  processStep,
}: {
  text?: string;
  segments?: TranscriptSegment[];
  isProcessing: boolean;
  processStep?: ProcessEvent | null;
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'segments'>('text');
  const containerRef = useRef<HTMLDivElement>(null);

  const progress = processStep?.event === 'process' ? processStep : null;
  const hasSegments = segments.length > 0;
  const showSegments = activeTab === 'segments' && hasSegments;

  useEffect(() => {
    if (isProcessing && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, isProcessing]);

  const copyContent =
    showSegments
      ? segments.map((s) => `[${formatTime(s.from_ms)} → ${formatTime(s.to_ms)}] ${s.text}`).join('\n')
      : text ?? '';

  useEffect(() => {
    if (segments && segments.length > 0) {
      setActiveTab('segments');
    }
  }, [segments]);

  return (
    <div
      ref={containerRef}
      className="bg-bg border border-line rounded-lg min-h-64 max-h-80 lg:min-h-96 lg:max-h-[480px] overflow-y-auto"
    >
      <div className="sticky top-0 bg-surface border-b border-line px-4 py-3">
        <div className="flex justify-between items-center min-h-5">
          <div className="flex items-center gap-2">
            {isProcessing && <p role="status" className="text-xs text-accent">Transcribiendo...</p>}
            {!isProcessing && hasSegments && (
              <div className="flex items-center gap-1">
                {([
                  ['text', 'Texto'],
                  ['segments', 'Marcadores de tiempo'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    aria-pressed={activeTab === key}
                    className={`font-mono text-[10px] font-medium uppercase tracking-[0.18em] px-2.5 py-1 rounded-md transition-colors ${
                      activeTab === key ? 'bg-accent/10 text-accent' : 'text-muted hover:text-accent'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {(text || hasSegments) && !isProcessing && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(copyContent);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-lacre transition-colors"
            >
              {copied ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          )}
        </div>

        {progress && (
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex justify-between text-xs text-muted">
              <span className="truncate">{progress.step}</span>
              {progress.count != null && <span className="shrink-0 ml-2">{progress.count}%</span>}
            </div>
            <div
              role="progressbar"
              aria-label={`Progreso de transcripción: ${progress.step}`}
              aria-valuemin={0}
              aria-valuemax={100}
              {...(progress.count != null && { 'aria-valuenow': progress.count })}
              className="w-full h-0.5 rounded-full bg-line overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                style={{ width: `${progress.count != null ? progress.count : 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {showSegments ? (
        <div className="flex flex-col p-2">
          {segments.map((seg, i) => (
            <div key={i} className="flex gap-3 px-4 py-2.5">
              <span className="text-[11px] font-mono text-lacre shrink-0 pt-0.5 tabular-nums">
                {formatTime(seg.from_ms)}
              </span>
              <p className="text-base leading-relaxed">{seg.text}</p>
            </div>
          ))}
        </div>
      ) : (
        text && <p className="text-base leading-relaxed whitespace-pre-wrap p-4">{text}</p>
      )}
    </div>
  );
};
