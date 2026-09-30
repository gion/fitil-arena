import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'reference/**',
      'apps/client/ios/**',
      'apps/client/android/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/coverage/**',
      '**/.venv/**',
      'tools/voice/out/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Simularea trebuie să fie deterministă: fără RNG global, fără ceas, fără DOM.
    files: ['packages/sim/src/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Folosește RNG-ul cu seed din packages/sim.' },
        { object: 'Date', property: 'now', message: 'Simularea nu are voie să citească ceasul.' },
        { object: 'performance', property: 'now', message: 'Simularea nu are voie să citească ceasul.' },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'setTimeout',
        'setInterval',
        'requestAnimationFrame',
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Simularea nu are voie să citească ceasul.',
        },
      ],
    },
  },
  prettier,
);
