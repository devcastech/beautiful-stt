import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export const DisplayTranscript = ({ text, isProcessing }: { text?: string, isProcessing: boolean}) => {
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isProcessing && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, isProcessing]);

  return (
    <div
      ref={containerRef}
      className="border border-line rounded min-h-64 max-h-80 lg:min-h-96 lg:max-h-[480px] overflow-y-auto"
    >
      <div className={`flex justify-between items-center sticky top-0 bg-bg px-4 py-3 border-b border-line ${isProcessing ? 'animate-pulse' : ''}`}>
        <p className="text-xs text-muted uppercase tracking-widest">
          {isProcessing ? 'Transcribiendo...' : 'Transcripción'}
        </p>
        {text && !isProcessing && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors"
          >
            {copied ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        )}
      </div>
      {text && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap p-4">{text}</p>
      )}
    </div>
  );
};
