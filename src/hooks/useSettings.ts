import { useEffect, useState } from "react";
import { AppSettings, getSettings, saveSettings } from "../services/settings";
import { alertDialog } from "../services/dialog";

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, []);

  const update = async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    const previous = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      setSettings(await saveSettings(next));
    } catch (error) {
      setSettings(previous);
      void alertDialog(
        String(error),
        "No se pudo guardar la configuración",
        "error",
      );
    }
  };

  return { settings, update };
};
