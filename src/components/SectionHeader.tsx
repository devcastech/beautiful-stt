export const SectionHeader = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3">
    <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-accent shrink-0">
      {label}
    </h2>
    <div className="h-px flex-1 bg-line" />
  </div>
);
