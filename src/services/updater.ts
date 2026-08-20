import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateProgress = {
  downloaded: number;
  total: number;
  percent: number;
};

export async function checkForUpdates(): Promise<Update | null> {
  return await check();
}

export async function downloadAndInstall(
  update: Update,
  onProgress: (p: UpdateProgress) => void,
): Promise<void> {
  let downloaded = 0;
  let total = 0;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        total = event.data.contentLength ?? 0;
        onProgress({ downloaded: 0, total, percent: 0 });
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        onProgress({
          downloaded,
          total,
          percent: total ? Math.round((downloaded / total) * 100) : 0,
        });
        break;
      case 'Finished':
        onProgress({ downloaded, total, percent: 100 });
        break;
    }
  });
  await relaunch();
}
