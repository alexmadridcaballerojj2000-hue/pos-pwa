import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import fs from 'fs';
import path from 'path';

describe('Architecture & Layer Boundaries', () => {
  it('all architectural directories defined in SPEC §4 exist', () => {
    const requiredDirs = [
      'src/domain',
      'src/domain/ports',
      'src/data',
      'src/sync',
      'src/hardware',
      'src/features',
      'src/ui',
      'src/app',
      'src/sw',
      'src/test',
    ];

    for (const dir of requiredDirs) {
      expect(fs.existsSync(path.resolve(process.cwd(), dir))).toBe(true);
    }
  });

  it('ESLint blocks prohibited imports (react, dexie, outer layers) and fetch/Date.now() in src/domain', async () => {
    const eslint = new ESLint();

    const illegalDomainCode = `
import { useState } from 'react';
import Dexie from 'dexie';
import { App } from '@/app/App';

export function illegalFunction() {
  const time = Date.now();
  fetch('https://example.com');
  return { time };
}
`;

    const results = await eslint.lintText(illegalDomainCode, {
      filePath: path.resolve(process.cwd(), 'src/domain/illegal-test.ts'),
    });

    const errorRules = results[0]?.messages.map((m) => m.ruleId) ?? [];

    expect(errorRules).toContain('no-restricted-imports');
    expect(errorRules).toContain('no-restricted-globals');
    expect(errorRules).toContain('no-restricted-properties');
  });

  it('ESLint allows clean domain code in src/domain', async () => {
    const eslint = new ESLint();

    const validDomainCode = `
export type Minor = number;
export function addMoney(a: Minor, b: Minor): Minor {
  return a + b;
}
`;

    const results = await eslint.lintText(validDomainCode, {
      filePath: path.resolve(process.cwd(), 'src/domain/valid-test.ts'),
    });

    const errors = results[0]?.messages.filter((m) => m.severity === 2) ?? [];
    expect(errors.length).toBe(0);
  });
});
