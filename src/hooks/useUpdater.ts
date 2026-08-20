import type { Update } from '@tauri-apps/plugin-updater';
import { useCallback, useEffect, useState } from 'react';
import { checkForUpdates, downloadAndInstall, type UpdateProgress } from '../services/updater.ts';

export type UpdaterStatus = 'checking' | 'uptodate' | 'available' | 'downloading' | 'error';

export interface UpdaterState {
  status: UpdaterStatus;
  update: Update | null;
  progress: UpdateProgress | null;
  install: () => Promise<void>;
}

export function useUpdater(): UpdaterState {
  const [status, setStatus] = useState<UpdaterStatus>('checking');
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    console.log('checking for updates');
    (async () => {
      try {
        const found = await checkForUpdates();
        console.log('found', found)
        if (cancelled) return;
        setUpdate(found);
        setStatus(found ? 'available' : 'uptodate');
      } catch (e) {
        console.error(e);
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const install = useCallback(async () => {
    if (!update) return;
    setStatus('downloading');
    try {
      await downloadAndInstall(update, setProgress);
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }, [update]);

  return { status, update, progress, install };
}
