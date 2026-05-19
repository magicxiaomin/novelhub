/** @type {import('eslint').Linter.Config} */
const dramaImportGuard = [
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
];

module.exports = {
  extends: ['../../.eslintrc.cjs', 'next/core-web-vitals'],
  settings: {
    next: {
      rootDir: ['apps/web/'],
    },
  },
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
  },
  overrides: [
    {
      files: ['src/**/*.{ts,tsx}'],
      excludedFiles: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
      rules: {
        'no-restricted-imports': dramaImportGuard,
      },
    },
  ],
};
