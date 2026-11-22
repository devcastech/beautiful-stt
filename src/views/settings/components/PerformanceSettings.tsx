import { Select, SelectOption } from "../../../components/Select";
import { Switch } from "../../../components/Switch";
import { useSettings } from "../../../hooks/useSettings";
import { ModelInfo } from "../../../services/getModels";
import { formatBytes } from "../../../lib/utils";
import { PRECISION_LABEL, VAD_LABEL } from "../../../lib/settingLabels";
import { PRECISION_LEVELS, precisionLevel } from "../../../lib/precisionLevels";
import { isMacOS } from "../../../services/runtime";
import { AccelerationSettings } from "./AccelerationSettings";

const AUTO = "auto";

const PRECISION_OPTIONS: SelectOption[] = [
  { value: AUTO, label: "Auto", description: "Recomendado, se ajusta según el equipo" },
  ...PRECISION_LEVELS.map(({ beamSize, label, description }) => ({
    value: String(beamSize),
    label,
    description,
  })),
];

export const PerformanceSettings = ({ models }: { models: ModelInfo[] }) => {
  const { settings, update } = useSettings();
  if (!settings) return null;

  const modelOptions: SelectOption[] = models
    .filter((m) => m.downloaded)
    .map((m) => ({
      value: m.name,
      label: m.label,
      meta: formatBytes(m.disk_size ?? m.size),
      description: m.description,
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
      <div className="bg-surface rounded-3xl p-5 flex flex-col gap-5">
        <Select
          label="Modelo por defecto"
          value={settings.default_model}
          onChange={(value) => update({ default_model: value })}
          options={modelOptions}
        />
        <Select
          label={PRECISION_LABEL}
          hint="Cantidad de alternativas que se evalúan por cada frase antes de elegir la más probable. Un nivel más alto reduce errores en audios difíciles (ruido, acentos, varias voces), pero aumenta el tiempo de transcripción. Auto ajusta el nivel según el equipo."
          value={
            settings.beam_size == null
              ? AUTO
              : String(precisionLevel(settings.beam_size).beamSize)
          }
          onChange={(value) =>
            update({ beam_size: value === AUTO ? null : Number(value) })
          }
          options={PRECISION_OPTIONS}
        />
        <Switch
          label={VAD_LABEL}
          hint="Detecta los tramos sin voz y no los procesa: transcribe más rápido y evita frases inventadas en las pausas."
          checked={settings.vad}
          onChange={(vad) => update({ vad })}
        />
      </div>

      {!isMacOS() && (
        <AccelerationSettings
          enabled={settings.use_gpu}
          onChange={(use_gpu) => update({ use_gpu })}
        />
      )}
    </div>
  );
};
