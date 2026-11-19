import { createContext, use, useState } from "react";

export const VIEWS = {
  transcript: "transcript",
  settings: "settings",
} as const;

export type View = (typeof VIEWS)[keyof typeof VIEWS];

interface ViewContextValue {
  view: View;
  setView: (view: View) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

export const ViewProvider = ({ children }: { children: React.ReactNode }) => {
  const [view, setView] = useState<View>(VIEWS.transcript);
  return <ViewContext value={{ view, setView }}>{children}</ViewContext>;
};

export const useView = () => {
  const ctx = use(ViewContext);
  if (!ctx) throw new Error("Internal error");
  return ctx;
};
