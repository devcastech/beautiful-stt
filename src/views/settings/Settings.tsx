import { SectionHeader } from "../../components/SectionHeader";
import { Activity, useEffect, useState } from "react";
import { ModelsTable } from "./components/ModelsTable";
import { Navigation, SettingsTab, TABS } from "./components/Navigation";
import { getModelList, ModelInfo } from "../../services/getModels";

export const Settings = () => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [tab, setTab] = useState<SettingsTab>(TABS.PERFORMANCE);

  const getAvailableModels = () => {
    getModelList().then(setModels).catch(console.error);
  };
  useEffect(() => {
    getAvailableModels();
  }, []);

  return (
    <div className="w-full h-full mx-auto px-6 lg:px-8 py-6 flex flex-col gap-6">
      <div className="h-full flex flex-col gap-2">
        <SectionHeader label="Configuración" />
        <div className="h-full flex justify-between items-start gap-4">
          <Navigation tab={tab} setTab={setTab} />
          <div className="flex-1 rounded-md overflow-hidden">
            <Activity mode={tab === TABS.PERFORMANCE ? "visible" : "hidden"}>
              <div>Rendimiento</div>
              {/*pendiente implementar*/}
            </Activity>
            <Activity mode={tab === TABS.MODELS ? "visible" : "hidden"}>
              <ModelsTable models={models} onRefresh={getAvailableModels} />
            </Activity>
          </div>
        </div>
      </div>
    </div>
  );
};
