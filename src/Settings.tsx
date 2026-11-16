import { invoke } from "@tauri-apps/api/core";
import { SectionHeader } from "./components/SectionHeader";
import { Activity, useEffect, useState } from "react";
import { Check, CloudDownload } from "lucide-react";

const navigation = [
  {
    id: "models",
    label: "modelos",
  },
  {
    id: "process_mode",
    label: "modo de procesamiento",
  },
];

interface ModelInfo {
  name: string;
  size: number;
  modified: number | undefined;
  downloaded: boolean;
}

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

export const Settings = () => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [tab, setTab] = useState("models");

  const getModels = async () => {
    const models = await invoke("get_models");
    setModels(models as ModelInfo[]);
    console.log("models: ", models);
  };
  useEffect(() => {
    getModels();
  }, []);

  return (
    <div className="w-full h-full mx-auto px-6 lg:px-8 py-6 flex flex-col gap-6">
      <div className="h-full flex flex-col gap-2">
        <SectionHeader label="Configuración" />
        <div className="h-full flex justify-between items-start gap-4">
          <nav className="w-75 h-full min-h-full flex flex-col gap-2 pr-2 py-4 rounded-md border-r border-line">
            <ul>
              {navigation.map((item) => (
                <li
                  className={`p-2
                    ${item.id === tab ? "bg-line/80" : "hover:bg-line/50"}
                    `}
                  key={item.id}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex-1 rounded-md overflow-hidden">
            <Activity mode={tab === "models" ? "visible" : "hidden"}>
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
                      <td
                        colSpan={2}
                        className="px-4 py-6 text-center text-muted"
                      >
                        No hay modelos descargados
                      </td>
                    </tr>
                  ) : (
                    models.map((model) => (
                      <tr
                        key={model.name}
                        className="border-b border-line last:border-b-0"
                      >
                        <td className="px-4 py-2 font-mono text-xs">
                          {model.name}
                        </td>
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
            </Activity>
            <Activity mode={tab === "process_mode" ? "visible" : "hidden"}>
              <div>procesamiento</div>
              {/*pendiente implementar*/}
            </Activity>
          </div>
        </div>
      </div>
    </div>
  );
};
