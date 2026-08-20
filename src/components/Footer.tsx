import { Download } from "lucide-react";
import { useAppVersion } from "../hooks/useAppVersion";
import { ThemeToggle } from "./ThemeToggle";
import { useUpdater } from "../hooks/useUpdater";
export const Footer = () => {
  const version = useAppVersion();
  const updater = useUpdater();
  return (
    <footer className="grid grid-cols-3 items-center px-8 py-3 border-t border-line">
      <div className="flex items-center gap-3">
        {version && (
          <span
            className="text-[11px] text-muted font-mono tabular-nums"
            title="App version"
          >
            <strong>v{version}</strong>
          </span>
        )}

        {updater?.status === "available" && (
          <button
            type="button"
            onClick={() => void updater.install()}
            className="flex items-center gap-2 rounded-md text-[11px] border border-line text-muted hover:text-accent hover:border-accent/60 transition-colors py-1 px-2"
          >
            <Download size={12} aria-hidden="true" />v{updater.update?.version}{" "}
            install
          </button>
        )}

        {updater?.status === "downloading" && (
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span>Updating to v{updater.update?.version} </span>
            <div className="w-24 h-1 rounded bg-line overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${updater.progress?.percent ?? 0}%` }}
              />
            </div>
            <span>{updater.progress?.percent ?? 0}%</span>{" "}
          </div>
        )}

        {updater?.status === "error" && (
          <span className="text-[11px] text-muted">Update check failed</span>
        )}
      </div>
      <div className="flex justify-center items-center gap-1.5">
        <span className="text-xs text-muted">by</span>
        <a
          href="https://eduar.tech"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs"
        >
          eduar.tech
        </a>
      </div>
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
    </footer>
  );
};
