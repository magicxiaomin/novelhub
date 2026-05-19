/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  ignorePatterns: ['node_modules/', 'dist/', '.next/', 'coverage/', '*.config.cjs', '*.config.js'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
  },
  overrides: [
    {
      files: ['apps/web/src/**/*.{ts,tsx}'],
      excludedFiles: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '*drama*',
                  '**/*drama*',
                  '../**/*drama*',
                  '**/drama',
                  '**/drama-*',
                  '**/dramas',
                  '**/dramas/*',
                ],
                message:
                  'Short-drama modules are quarantined and must not be imported by active web surfaces.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['apps/api/src/**/*.{ts,tsx}'],
      excludedFiles: [
        '**/*.spec.ts',
        '**/*.test.ts',
        'apps/api/src/worker.ts',
        'apps/api/src/worker/routes/drama*.ts',
        'apps/api/src/worker/routes/dramas.ts',
        'apps/api/src/worker/routes/episodes.ts',
        'apps/api/src/modules/admin/admin.controller.ts',
        'apps/api/src/modules/admin/dto/drama*.ts',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '*drama*',
                  '**/*drama*',
                  '../**/*drama*',
                  '**/drama',
                  '**/drama-*',
                  '**/dramas',
                  '**/dramas/*',
                ],
                message:
                  'Short-drama modules are quarantined and must not be imported by active API surfaces.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['apps/web/**/*.{ts,tsx}'],
      extends: ['next/core-web-vitals'],
      settings: {
        next: {
          rootDir: ['apps/web/'],
        },
      },
      env: {
        browser: true,
        node: true,
      },
      rules: {
        '@next/next/no-html-link-for-pages': 'off',
      },
    },
    {
      files: ['**/*.spec.ts', '**/*.test.ts', 'apps/api/test/**/*.ts'],
      env: {
        jest: true,
        node: true,
      },
    },
  ],
};
