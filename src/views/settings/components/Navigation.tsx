import { Dispatch, SetStateAction } from "react";

export const TABS = {
  PERFORMANCE: "performance",
  MODELS: "models",
} as const;

export type SettingsTab = (typeof TABS)[keyof typeof TABS];

const navigation: {
  id: SettingsTab;
  label: string;
}[] = [
  {
    id: TABS.PERFORMANCE,
    label: "Rendimiento",
  },
  {
    id: TABS.MODELS,
    label: "Modelos",
  },
];

export const Navigation = ({
  tab,
  setTab,
}: {
  tab: SettingsTab;
  setTab: Dispatch<SetStateAction<SettingsTab>>;
}) => {
  return (
    <nav className="w-75 h-full min-h-full flex flex-col gap-2 pr-2 py-4 rounded-md border-r border-line">
      <ul>
        {navigation.map((item, index) => (
          <li
            className={`p-2 cursor-pointer
              ${item.id === tab ? "border-accent/60 bg-accent/10 text-accent" : "border-line text-muted hover:text-accent hover:border-accent/60"}
              `}
            key={`${item.id}${index}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </nav>
  );
};
