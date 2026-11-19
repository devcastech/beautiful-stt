import { ProcessEvent } from "../AudioProcessor";

export const DownloadSteps = ({
  processDownloadAssetsStep,
}: {
  processDownloadAssetsStep: ProcessEvent;
}) => {
  return (
    <div className="flex flex-col gap-1 mt-2">
      <div className="flex justify-between text-xs text-muted">
        <span className="truncate">{processDownloadAssetsStep.step}</span>
        {processDownloadAssetsStep.count != null && (
          <span className="shrink-0 ml-2">
            {processDownloadAssetsStep.count}%
          </span>
        )}
      </div>
      <div
        role="processDownloadAssetsStepbar"
        aria-label={`Progreso de descarga de assets: ${processDownloadAssetsStep.step}`}
        aria-valuemin={0}
        aria-valuemax={100}
        {...(processDownloadAssetsStep.count != null && {
          "aria-valuenow": processDownloadAssetsStep.count,
        })}
        className="w-full h-0.5 rounded-full bg-line overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
          style={{
            width: `${processDownloadAssetsStep.count != null ? processDownloadAssetsStep.count : 100}%`,
          }}
        />
      </div>
    </div>
  );
};
