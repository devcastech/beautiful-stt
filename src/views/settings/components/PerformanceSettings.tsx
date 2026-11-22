import { Select, SelectOption } from "../../../components/Select";
import { Switch } from "../../../components/Switch";
import { useSettings } from "../../../hooks/useSettings";
import { ModelInfo } from "../../../services/getModels";
import { formatBytes } from "../../../lib/utils";
import { isMacOS } from "../../../services/runtime";

const AUTO = "auto";

const PRECISION_NOTES: Record<number, string> = {
  1: "Lo más rápido · bien para audios claros",
  5: "Equilibrio entre calidad y velocidad",
  8: "Máxima precisión · bastante más lento sin aceleración",
};

const PRECISION_OPTIONS: SelectOption[] = [
  { value: AUTO, label: "Auto", description: "Recomendado · se ajusta según el equipo" },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    value: String(n),
    label: String(n),
    description: PRECISION_NOTES[n],
  })),
];

export const PerformanceSettings = ({ models }: { models: ModelInfo[] }) => {
  const { settings, update } = useSettings();
  if (!settings) return null;

  // Solo modelos descargados: un defecto sin descargar obligaría a bajarlo al arrancar.
  const modelOptions: SelectOption[] = models
    .filter((m) => m.downloaded)
    .map((m) => ({
      value: m.name,
      label: m.label,
      meta: formatBytes(m.disk_size ?? m.size),
      description: m.description,
    }));

  return (
    <div className="bg-surface rounded-3xl p-5 flex flex-col gap-5 max-w-xl">
      <Select
        label="Modelo por defecto"
        value={settings.default_model}
        onChange={(value) => update({ default_model: value })}
        options={modelOptions}
      />
      <Select
        label="Nivel de precisión"
        hint="Cantidad de alternativas que se evalúan por cada frase antes de elegir la más probable. Un nivel más alto reduce errores en audios difíciles (ruido, acentos, varias voces), pero aumenta el tiempo de transcripción. Auto ajusta el nivel según el equipo."
        value={settings.beam_size == null ? AUTO : String(settings.beam_size)}
        onChange={(value) =>
          update({ beam_size: value === AUTO ? null : Number(value) })
        }
        options={PRECISION_OPTIONS}
      />
      {/* En macOS la aceleración (Metal) siempre está activa: no hay nada que elegir. */}
      {!isMacOS() && (
        <Switch
          label="Aceleración por hardware"
          hint="Transcribe con la tarjeta gráfica, también la integrada, y suele ser bastante más rápido. Si no es compatible, se usa el procesador automáticamente."
          checked={settings.use_gpu}
          onChange={(use_gpu) => update({ use_gpu })}
        />
      )}
      <Switch
        label="Optimización de silencios"
        hint="Detecta los tramos sin voz y no los procesa: transcribe más rápido y evita frases inventadas en las pausas."
        checked={settings.vad}
        onChange={(vad) => update({ vad })}
      />
    </div>
  );
};
