import { describe, it, expect } from 'vitest';

describe('Smoke test', () => {
  it('environment runs Vitest tests correctly', () => {
    expect(1 + 1).toBe(2);
  });

  it('DOM environment is available via jsdom', () => {
    const el = document.createElement('div');
    el.textContent = 'POS PWA';
    expect(el.textContent).toBe('POS PWA');
  });
});
