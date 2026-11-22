import { useEffect, useId, useState } from "react";
import { Gpu } from "lucide-react";
import { Switch } from "../../../components/Switch";
import { GpuInfo, GpuKind, getGpus } from "../../../services/gpus";

const KIND_LABELS: Record<GpuKind, string> = {
  discrete: "Dedicada",
  integrated: "Integrada",
  other: "Otra",
};

type AccelerationSettingsProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

export const AccelerationSettings = ({
  enabled,
  onChange,
}: AccelerationSettingsProps) => {
  const listLabelId = useId();
  // null mientras carga o si el comando falla: así no se afirma que no hay tarjeta sin saberlo
  const [gpus, setGpus] = useState<GpuInfo[] | null>(null);

  useEffect(() => {
    getGpus().then(setGpus).catch(console.error);
  }, []);

  return (
    <div className="bg-surface rounded-3xl p-5 flex flex-col gap-4">
      <Switch
        label="Aceleración por hardware"
        checked={enabled}
        onChange={onChange}
      />

      {gpus &&
        (gpus.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span id={listLabelId} className="text-xs font-medium text-muted">
              Tarjetas gráficas detectadas
            </span>
            <ul aria-labelledby={listLabelId} className="flex flex-col gap-2">
              {gpus.map((gpu, index) => (
                <li
                  key={`${gpu.name}-${index}`}
                  className="flex items-center gap-3 rounded-2xl bg-elevated px-3 py-2.5"
                >
                  <Gpu
                    size={16}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className="shrink-0 text-muted"
                  />
                  <span className="flex-1 min-w-0 text-sm truncate" title={gpu.name}>
                    {gpu.name}
                  </span>
                  <span className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-surface text-muted">
                    {KIND_LABELS[gpu.kind]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted">
            No se detectó una tarjeta gráfica compatible. La transcripción usa
            el procesador.
          </p>
        ))}
    </div>
  );
};
