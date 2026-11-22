import { Fragment, ReactNode } from "react";
import { Cpu, Gpu } from "lucide-react";
import { PRECISION_LABEL, VAD_LABEL } from "../../../lib/settingLabels";
import { precisionLevel } from "../../../lib/precisionLevels";
import { TranscriptionParams } from "../../../services/transcription";

const deviceLabel = ({ device, threads }: TranscriptionParams) =>
  device.type === "gpu"
    ? (device.name ?? "Tarjeta gráfica")
    : `Procesador (${threads} hilos)`;

type Row = { label: string; value: ReactNode };

export const TranscriptionParamsCard = ({
  params,
}: {
  params: TranscriptionParams | null;
}) => {
  if (!params) return null;

  const DeviceIcon = params.device.type === "gpu" ? Gpu : Cpu;
  const rows: Row[] = [
    {
      label: "Dispositivo",
      value: (
        <>
          <DeviceIcon
            size={14}
            strokeWidth={1.75}
            aria-hidden="true"
            className="shrink-0 mt-[3px] text-muted"
          />
          <span className="min-w-0 break-words">{deviceLabel(params)}</span>
        </>
      ),
    },
    { label: PRECISION_LABEL, value: precisionLevel(params.beam_size).label },
    { label: VAD_LABEL, value: params.vad ? "Activada" : "Desactivada" },
  ];

  return (
    <div className="bg-surface rounded-3xl p-5 flex flex-col gap-3">
      <h2 className="text-xs font-medium text-muted">Procesamiento</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map(({ label, value }) => (
          <Fragment key={label}>
            <dt className="text-muted">{label}</dt>
            <dd className="flex items-start gap-1.5 min-w-0 tabular-nums">
              {value}
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
};
