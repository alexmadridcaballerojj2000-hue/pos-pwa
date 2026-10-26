import { useEffect, useRef } from 'react';

export interface UseBarcodeScannerOptions {
  /**
   * Callback invoked when a valid barcode scan burst is detected.
   */
  onScan: (barcode: string) => void;

  /**
   * Maximum interval in milliseconds between consecutive keystrokes to be considered
   * part of a hardware barcode scanner burst.
   * Default: 35 ms (SPEC §9).
   */
  maxIntervalMs?: number;

  /**
   * Minimum number of characters required for a valid barcode.
   * Default: 3 characters.
   */
  minChars?: number;

  /**
   * Whether the scanner listener is currently active.
   * Default: true.
   */
  enabled?: boolean;

  /**
   * Element to attach listener to. Defaults to window.
   */
  target?: EventTarget | null;
}

/**
 * Global hook to detect hardware barcode scanner input in keyboard-wedge mode.
 * Identifies fast keystroke bursts (< 35 ms) terminated by Enter.
 *
 * SPEC §9:
 * "hook global useBarcodeScanner que detecta ráfagas (caracteres con < 35 ms entre sí)
 * terminadas en Enter y las envía a la búsqueda por código. No debe interferir con
 * campos de texto normales."
 */
export function useBarcodeScanner({
  onScan,
  maxIntervalMs = 35,
  minChars = 3,
  enabled = true,
  target,
}: UseBarcodeScannerOptions): void {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const eventTarget = target ?? (typeof window !== 'undefined' ? window : null);
    if (!eventTarget) return;

    const handleKeyDown = (event: Event) => {
      const e = event as KeyboardEvent;

      // Ignore non-printable modifier/navigation keys
      if (
        e.key === 'Shift' ||
        e.key === 'Control' ||
        e.key === 'Alt' ||
        e.key === 'Meta' ||
        e.key === 'CapsLock' ||
        e.key === 'Tab' ||
        e.key === 'Escape' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight'
      ) {
        return;
      }

      const now = performance.now();
      const elapsed = now - lastKeyTimeRef.current;

      // Handle Enter (barcode terminator)
      if (e.key === 'Enter') {
        const currentBuffer = bufferRef.current;
        const isRapid = elapsed <= maxIntervalMs * 1.5;

        if (currentBuffer.length >= minChars && (isRapid || lastKeyTimeRef.current > 0)) {
          // Valid barcode burst detected
          e.preventDefault();
          e.stopPropagation();

          const scannedCode = currentBuffer;
          bufferRef.current = '';
          lastKeyTimeRef.current = 0;
          if (timeoutIdRef.current) {
            clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = null;
          }

          onScanRef.current(scannedCode);
          return;
        }

        // Not a scanner burst, clear buffer
        bufferRef.current = '';
        lastKeyTimeRef.current = 0;
        return;
      }

      // Check for single character printable keys
      if (e.key.length === 1) {
        // Clear timeout reset
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
          timeoutIdRef.current = null;
        }

        if (elapsed <= maxIntervalMs) {
          // Burst continues
          bufferRef.current += e.key;
        } else {
          // Human typing or new burst starting
          bufferRef.current = e.key;
        }

        lastKeyTimeRef.current = now;

        // Auto-reset buffer if no subsequent key arrives within burst threshold
        timeoutIdRef.current = setTimeout(() => {
          bufferRef.current = '';
          lastKeyTimeRef.current = 0;
        }, maxIntervalMs * 2.5);
      }
    };

    eventTarget.addEventListener('keydown', handleKeyDown, true);

    return () => {
      eventTarget.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      bufferRef.current = '';
      lastKeyTimeRef.current = 0;
    };
  }, [enabled, maxIntervalMs, minChars, target]);
}
