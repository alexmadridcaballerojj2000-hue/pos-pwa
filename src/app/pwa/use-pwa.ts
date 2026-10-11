import { useState, useEffect } from 'react';
import { Workbox } from 'workbox-window';

export interface PwaState {
  needRefresh: boolean;
  offlineReady: boolean;
  isOnline: boolean;
  updateServiceWorker: () => Promise<void>;
}

export function usePwa(): PwaState {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [wb, setWb] = useState<Workbox | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
      const workbox = new Workbox('/sw.js');

      workbox.addEventListener('waiting', () => {
        setNeedRefresh(true);
      });

      workbox.addEventListener('activated', (event) => {
        if (!event.isUpdate) {
          setOfflineReady(true);
        }
      });

      workbox.register();
      setWb(workbox);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateServiceWorker = async () => {
    if (wb) {
      wb.messageSkipWaiting();
      window.location.reload();
    }
  };

  return {
    needRefresh,
    offlineReady,
    isOnline,
    updateServiceWorker,
  };
}
