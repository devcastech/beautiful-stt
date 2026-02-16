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
      className={`rounded-xl bg-surface min-h-64 max-h-80 lg:min-h-90 lg:max-h-96 overflow-y-auto `}
    >
      <div className={`flex justify-between items-center mb-2 bg-surface sticky top-0 p-4 ${isProcessing ? 'animate-pulse' : ''}`}>
        <p className="text-xs text-muted uppercase tracking-wider">{
          isProcessing ? "Transcribiendo..." : "Transcripción"
        }</p>
        {text  && !isProcessing && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        )}
      </div>
      {text && <p className="text-sm leading-relaxed whitespace-pre-wrap px-2">{text}</p>}
    </div>
  );
};
