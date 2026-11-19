import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/useTheme";
import { RailButton } from "./RailButton";

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <RailButton
      label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      onClick={toggleTheme}
    >
      {isDark ? (
        <Sun size={18} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Moon size={18} strokeWidth={1.75} aria-hidden="true" />
      )}
    </RailButton>
  );
};
