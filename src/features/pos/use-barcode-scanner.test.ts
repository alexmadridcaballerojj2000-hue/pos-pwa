import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBarcodeScanner } from './use-barcode-scanner';

describe('useBarcodeScanner (S4-T2)', () => {
  let currentTime = 1000;

  beforeEach(() => {
    vi.useFakeTimers();
    currentTime = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => currentTime);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function simulateKeyPress(key: string, deltaMs = 15, target: EventTarget = window) {
    currentTime += deltaMs;
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  }

  function simulateBarcodeScan(barcode: string, intervalMs = 15, target: EventTarget = window) {
    for (const char of barcode) {
      simulateKeyPress(char, intervalMs, target);
    }
    return simulateKeyPress('Enter', intervalMs, target);
  }

  it('detects hardware scanner bursts (< 35 ms + Enter) and invokes onScan', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan, maxIntervalMs: 35 }));

    const enterEvent = simulateBarcodeScan('750100012345', 10);

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('750100012345');
    expect(enterEvent.defaultPrevented).toBe(true);
  });

  it('discards slow human typing (> 50 ms between keys)', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan, maxIntervalMs: 35 }));

    // Simulate human typing "hello" with 100ms between keys
    simulateKeyPress('h', 100);
    simulateKeyPress('e', 100);
    simulateKeyPress('l', 100);
    simulateKeyPress('l', 100);
    simulateKeyPress('o', 100);
    const enterEvent = simulateKeyPress('Enter', 100);

    expect(onScan).not.toHaveBeenCalled();
    expect(enterEvent.defaultPrevented).toBe(false);
  });

  it('discards bursts that are shorter than minChars', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan, minChars: 4 }));

    // Only 2 characters
    simulateBarcodeScan('12', 10);

    expect(onScan).not.toHaveBeenCalled();
  });

  it('ignores modifier keys without breaking the scan buffer', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan, maxIntervalMs: 35 }));

    simulateKeyPress('A', 10);
    simulateKeyPress('Shift', 5); // modifier key ignored
    simulateKeyPress('B', 10);
    simulateKeyPress('C', 10);
    simulateKeyPress('Enter', 10);

    expect(onScan).toHaveBeenCalledWith('ABC');
  });

  it('handles 10 products scanned in rapid succession without lost scans', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan, maxIntervalMs: 35 }));

    const scannedCodes: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const code = `75010000000${i}`;
      scannedCodes.push(code);

      // 50ms pause between separate items, then 10ms burst per item
      currentTime += 50;
      simulateBarcodeScan(code, 10);
    }

    expect(onScan).toHaveBeenCalledTimes(10);
    for (let i = 0; i < 10; i++) {
      expect(onScan).toHaveBeenNthCalledWith(i + 1, scannedCodes[i]);
    }
  });

  it('does not listen or trigger when enabled is false', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan, enabled: false }));

    simulateBarcodeScan('750100012345', 10);

    expect(onScan).not.toHaveBeenCalled();
  });

  it('clears buffer on timeout if scan is interrupted without Enter', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan, maxIntervalMs: 35 }));

    // Start typing rapidly
    simulateKeyPress('1', 10);
    simulateKeyPress('2', 10);
    simulateKeyPress('3', 10);

    // Timeout occurs (e.g. 150 ms pause)
    currentTime += 150;
    vi.advanceTimersByTime(150);

    // Later, user presses Enter
    simulateKeyPress('Enter', 10);

    expect(onScan).not.toHaveBeenCalled();
  });
});
