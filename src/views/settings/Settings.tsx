import { Activity, useCallback, useEffect, useState } from "react";
import { Boxes, Gauge } from "lucide-react";
import { Page } from "../../components/Page";
import {
  SegmentedTabItem,
  SegmentedTabs,
  TabPanel,
} from "../../components/SegmentedTabs";
import { VIEWS, useView } from "../../hooks/useView";
import { getModelList, ModelInfo } from "../../services/getModels";
import { ModelsList } from "./components/ModelsList";

const TABS = {
  PERFORMANCE: "performance",
  MODELS: "models",
} as const;

type SettingsTab = (typeof TABS)[keyof typeof TABS];

const SETTINGS_TABS: SegmentedTabItem<SettingsTab>[] = [
  { id: TABS.PERFORMANCE, label: "Rendimiento", icon: Gauge },
  { id: TABS.MODELS, label: "Modelos", icon: Boxes },
];

const ID_BASE = "settings";

export const Settings = () => {
  const { view } = useView();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [tab, setTab] = useState<SettingsTab>(TABS.PERFORMANCE);

  const getAvailableModels = useCallback(() => {
    getModelList().then(setModels).catch(console.error);
  }, []);

  useEffect(() => {
    if (view === VIEWS.settings) getAvailableModels();
  }, [view, getAvailableModels]);

  return (
    <Page
      title="Configuración"
      toolbar={
        <SegmentedTabs
          items={SETTINGS_TABS}
          value={tab}
          onChange={setTab}
          label="Secciones de configuración"
          idBase={ID_BASE}
        />
      }
    >
      <Activity mode={tab === TABS.PERFORMANCE ? "visible" : "hidden"}>
        <TabPanel idBase={ID_BASE} value={TABS.PERFORMANCE}>
          <div className="bg-surface rounded-3xl px-6 py-12 flex flex-col items-center gap-2 text-center text-muted">
            <Gauge size={22} strokeWidth={1.5} aria-hidden="true" />
            <p className="text-sm">Próximamente</p>
          </div>
        </TabPanel>
      </Activity>
      <Activity mode={tab === TABS.MODELS ? "visible" : "hidden"}>
        <TabPanel idBase={ID_BASE} value={TABS.MODELS}>
          <ModelsList models={models} onRefresh={getAvailableModels} />
        </TabPanel>
      </Activity>
    </Page>
  );
};
