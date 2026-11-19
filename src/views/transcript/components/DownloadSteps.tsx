import { ProgressBar } from "../../../components/ProgressBar";
import { ProcessEvent } from "../AudioProcessor";

export const DownloadSteps = ({
  processDownloadAssetsStep,
}: {
  processDownloadAssetsStep: ProcessEvent;
}) => (
  <ProgressBar
    label={processDownloadAssetsStep.step}
    value={processDownloadAssetsStep.count}
    ariaLabel={`Progreso de descarga: ${processDownloadAssetsStep.step}`}
  />
);
