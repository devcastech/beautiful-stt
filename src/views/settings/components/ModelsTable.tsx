import { Check, CloudDownload } from "lucide-react";
import { ModelInfo } from "../../../services/getModels";
const dateFormatter = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
});

const parseDate = (seconds: number | null) =>
  seconds == null ? "—" : dateFormatter.format(new Date(seconds * 1000));

const parseSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  else if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  else if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  else return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const ModelsTable = ({ models }: { models: ModelInfo[] }) => {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Modelos descargados</caption>
      <thead>
        <tr className="border-b border-line">
          <th
            scope="col"
            className="px-4 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-accent"
          >
            Modelo
          </th>
          <th
            scope="col"
            className="px-4 py-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-accent"
          >
            Tamaño
          </th>
          <th
            scope="col"
            className="px-4 py-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-accent"
          >
            Modificado
          </th>
          <th
            scope="col"
            className="px-4 py-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-accent"
          ></th>
        </tr>
      </thead>
      <tbody>
        {models.length === 0 ? (
          <tr>
            <td colSpan={2} className="px-4 py-6 text-center text-muted">
              No hay modelos descargados
            </td>
          </tr>
        ) : (
          models.map((model) => (
            <tr
              key={model.name}
              className="border-b border-line last:border-b-0"
            >
              <td className="px-4 py-2 font-mono text-xs">{model.name}</td>
              <td className="px-4 py-2 text-right font-mono text-xs text-muted tabular-nums whitespace-nowrap">
                {parseSize(model.size)}
              </td>
              <td className="px-4 py-2 text-right font-mono text-xs text-muted tabular-nums whitespace-nowrap">
                {model.modified ? parseDate(model.modified) : "-"}
              </td>
              <td className="px-4 py-2 flex flex-col items-center text-right font-mono text-xs text-muted tabular-nums whitespace-nowrap">
                {model.downloaded ? (
                  <Check width={16} />
                ) : (
                  <button
                  //onClick={TODO: implement download model}
                  >
                    <CloudDownload width={16} />
                  </button>
                )}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
};
