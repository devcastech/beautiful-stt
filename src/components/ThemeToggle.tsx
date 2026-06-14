import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/useTheme';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-line text-muted hover:text-accent hover:border-accent/60 transition-colors"
    >
      {isDark ? <Sun size={12} strokeWidth={1.5} /> : <Moon size={12} strokeWidth={1.5} />}
    </button>
  );
};
