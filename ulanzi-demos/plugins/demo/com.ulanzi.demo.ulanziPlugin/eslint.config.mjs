// @ts-check
import js from '@eslint/js';

export default [
  {
    // Ignore library files and generated assets
    ignores: ['plugin/libs/**', 'node_modules/**', 'libs/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        // Browser globals
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        Worker: 'readonly',
        fetch: 'readonly',
        Blob: 'readonly',
        performance: 'readonly',
        Math: 'readonly',
        // Plugin global injected by UlanziStudio
        $UD: 'readonly',
        // Action classes (loaded via script tags, available globally in browser context)
        BaseAction: 'readonly',
        ClockAction: 'readonly',
        CounterAction: 'readonly',
        StatusAction: 'readonly',
        CalendarAction: 'readonly',
        PomodoroAction: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Test files: allow require, jest globals
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        jest: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        afterAll: 'readonly',
        beforeAll: 'readonly',
      },
    },
  },
];
