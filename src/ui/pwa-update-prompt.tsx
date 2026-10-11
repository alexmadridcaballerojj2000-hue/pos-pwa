import { useState } from 'react';
import { usePwa } from '@/app/pwa/use-pwa';
import { RefreshCw, WifiOff, X } from 'lucide-react';

export function PwaUpdatePrompt() {
  const { needRefresh, isOnline, updateServiceWorker } = usePwa();
  const [dismissed, setDismissed] = useState(false);

  return (
    <>
      {/* Offline Indicator Toast */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-3 right-3 z-50 flex items-center space-x-2 bg-amber-600 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium animate-pulse"
        >
          <WifiOff className="h-4 w-4" />
          <span>Sin conexión (Modo Offline)</span>
        </div>
      )}

      {/* Update Available Prompt */}
      {needRefresh && !dismissed && (
        <aside
          role="region"
          aria-label="Aviso de actualización"
          className="fixed bottom-20 md:bottom-4 right-4 z-50 max-w-sm rounded-xl border bg-card p-4 shadow-xl text-card-foreground"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-1">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                Actualización disponible
              </h2>
              <p className="text-xs text-muted-foreground">
                Hay una nueva versión disponible de la aplicación.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Cerrar aviso de actualización"
              className="text-muted-foreground hover:text-foreground p-1 rounded-md min-h-[32px] min-w-[32px] flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg min-h-[48px]"
            >
              Más tarde
            </button>
            <button
              type="button"
              onClick={() => void updateServiceWorker()}
              className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg min-h-[48px] shadow-sm flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Actualizar
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
