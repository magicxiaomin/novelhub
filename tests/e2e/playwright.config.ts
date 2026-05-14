import { defineConfig, devices } from '@playwright/test';

function definedEnv(env: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in env) {
    const value = env[key];
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}

const novelFixturesEnabledForRun = (): boolean =>
  process.env.NOVELHUB_E2E_NOVEL_FIXTURES === '1' ||
  process.argv.some((arg) => arg.includes('novel-funnel'));

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['list']],
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm --filter @novelhub/web dev',
        cwd: '../..',
        env: definedEnv({
          CI: process.env.CI,
          HOME: process.env.HOME,
          PATH: process.env.PATH,
          NOVELHUB_E2E_DRAMA_FIXTURES: '1',
          NOVELHUB_E2E_NOVEL_FIXTURES: novelFixturesEnabledForRun() ? '1' : undefined,
          NEXT_PUBLIC_R2_PUBLIC_HOST: novelFixturesEnabledForRun()
            ? 'novel-e2e-content.test'
            : undefined,
          NOVELHUB_RUNTIME_ENV: 'ci-e2e',
        }),
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: 'http://localhost:3000',
      },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
