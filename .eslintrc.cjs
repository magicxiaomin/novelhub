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
