import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '*.d.ts',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/domain must be pure TypeScript (no React).' },
            { name: 'react-dom', message: 'src/domain must be pure TypeScript (no React).' },
            { name: 'dexie', message: 'src/domain must not import Dexie directly (use ports).' },
            { name: 'dexie-react-hooks', message: 'src/domain must not import Dexie.' },
          ],
          patterns: [
            {
              group: ['@/data*', '@/features*', '@/ui*', '@/app*', '@/hardware*', '@/sync*', '@/sw*'],
              message: 'src/domain must not depend on outer layers.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'src/domain must not use fetch. Domain logic must be 100% offline and pure.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'src/domain must not use Date.now() directly; use an injected Clock.',
        },
      ],
    },
  },
  prettier,
);
