import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { isTauriRuntime } from '../services/runtime.ts';

export function useAppVersion(): string {
  const [version, setVersion] = useState('');
  useEffect(() => {
    if (!isTauriRuntime()) return;
    getVersion().then(setVersion).catch(console.error);
  }, []);
  return version;
}
