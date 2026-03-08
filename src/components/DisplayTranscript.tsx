import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ProcessEvent } from '../AudioProcessor';

export const DisplayTranscript = ({
  text,
  isProcessing,
  processStep,
}: {
  text?: string;
  isProcessing: boolean;
  processStep?: ProcessEvent | null;
}) => {
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const progress = processStep?.event === 'process' ? processStep : null;

  useEffect(() => {
    if (isProcessing && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, isProcessing]);

  return (
    <div
      ref={containerRef}
      className="bg-surface border border-line rounded-lg min-h-64 max-h-80 lg:min-h-96 lg:max-h-[480px] overflow-y-auto"
    >
      <div className="sticky top-0 bg-surface border-b border-line px-4 py-3">
        <div className="flex justify-between items-center">
          <p className={`text-xs uppercase tracking-widest ${isProcessing ? 'text-accent' : 'text-muted'}`}>
            {isProcessing ? 'Transcribiendo...' : 'Transcripción'}
          </p>
          {text && !isProcessing && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors"
            >
              {copied ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          )}
        </div>

        {/* Contextual progress bar */}
        {progress && (
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex justify-between text-xs text-muted">
              <span className="truncate">{progress.step}</span>
              {progress.count != null && <span className="shrink-0 ml-2">{progress.count}%</span>}
            </div>
            <div className="w-full h-0.5 rounded-full bg-line overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                style={{ width: `${progress.count != null ? progress.count : 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {text && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap p-4">{text}</p>
      )}
    </div>
  );
};
