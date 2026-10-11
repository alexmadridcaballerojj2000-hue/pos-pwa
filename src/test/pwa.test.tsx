import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { PwaUpdatePrompt } from '@/ui/pwa-update-prompt';

describe('PWA Configuration & Offline Readiness', () => {
  it('Service Worker source exists with precache and message listener', () => {
    const swPath = path.resolve(process.cwd(), 'src/sw/sw.ts');
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toContain('precacheAndRoute');
    expect(swContent).toContain('SKIP_WAITING');
    expect(swContent).toContain('NavigationRoute');
  });

  it('PWA icons exist in public directory', () => {
    const icon192 = path.resolve(process.cwd(), 'public/icons/icon-192.svg');
    const icon512 = path.resolve(process.cwd(), 'public/icons/icon-512.svg');
    const favicon = path.resolve(process.cwd(), 'public/favicon.svg');

    expect(fs.existsSync(icon192)).toBe(true);
    expect(fs.existsSync(icon512)).toBe(true);
    expect(fs.existsSync(favicon)).toBe(true);
  });

  it('renders offline banner when browser is offline', () => {
    // Mock navigator.onLine as false
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    render(<PwaUpdatePrompt />);

    expect(screen.getByText(/sin conexión/i)).toBeInTheDocument();

    // Restore
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
    });
  });
});
