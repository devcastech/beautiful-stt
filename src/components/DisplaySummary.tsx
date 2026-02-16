import { Check, Copy, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export const DisplaySummary = ({
  text,
  isGenerating,
}: {
  text?: string;
  isGenerating: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isGenerating && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, isGenerating]);

  return (
    <div
      ref={containerRef}
      className={`rounded-xl bg-surface min-h-64 max-h-80 lg:min-h-90 lg:max-h-96 overflow-y-auto ${
        isGenerating ? 'animate-pulse' : ''
      }`}
    >
      <div className="flex justify-between items-center mb-2 bg-surface sticky top-0 p-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-accent" />
          <p className="text-xs text-muted uppercase tracking-wider">
            {isGenerating ? 'Generando resumen...' : 'Resumen e ideas clave'}
          </p>
        </div>
        {text && !isGenerating && (
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
      {text && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap px-4 pb-4">
          {text}
        </p>
      )}
    </div>
  );
};