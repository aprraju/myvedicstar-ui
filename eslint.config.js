// @ts-check
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'apps/mobile/.expo/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      'apps/mobile/expo-env.d.ts',
      '**/mockServiceWorker.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  // Shared packages avoid platform APIs beyond fetch/Intl. query-cache supplies shared React hooks.
  {
    files: ['packages/**/*.ts'],
    rules: {
      // Web-standard APIs (fetch, URL, Intl, AbortController) are fine; browser-only globals are not.
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'navigator',
        'location',
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'react-native', 'expo*'],
              message: 'Shared packages must stay framework-agnostic.',
            },
            { group: ['@myvedicstar/*/src/*'], message: 'Import packages through their public entry point.' },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/query-cache/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react-native', 'expo*'],
              message: 'Shared cache code must not import native dependencies.',
            },
            { group: ['@myvedicstar/*/src/*'], message: 'Import packages through their public entry point.' },
          ],
        },
      ],
    },
  },
  // Web SPA.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      'react/no-danger': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Unsafe HTML injection is not allowed (see docs/security/frontend-security.md).',
        },
        {
          selector: "CallExpression[callee.name='fetch']",
          message: 'Call the backend through @myvedicstar/api-client, never fetch() directly.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@myvedicstar/*/src/*'], message: 'Import packages through their public entry point.' },
            {
              group: ['**/features/*/*', '!**/features/*/index'],
              message: 'Import a feature through its public index, not its internals.',
            },
          ],
        },
      ],
    },
  },
  // Mobile app.
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fetch']",
          message: 'Call the backend through @myvedicstar/api-client, never fetch() directly.',
        },
      ],
    },
  },
  // Node-executed configuration and scripts.
  {
    files: [
      '**/*.config.{js,ts,mjs,cjs}',
      '**/scripts/**/*.{js,ts,mjs}',
      'apps/web/security/**/*.ts',
      'eslint.config.js',
    ],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
  {
    files: [
      '**/*.cjs',
      'apps/mobile/babel.config.js',
      'apps/mobile/metro.config.js',
      'apps/mobile/jest.setup.js',
    ],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node, ...globals.jest } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  // Playwright fixtures call `use()`, which is not a React hook.
  {
    files: ['**/e2e/**/*.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
  // Tests may use the transport directly and relax a few rules.
  {
    files: ['**/*.test.{ts,tsx}', '**/test/**/*.{ts,tsx}', '**/e2e/**/*.ts', '**/__tests__/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
