const allowedRuntimeEnvironments = ['development', 'test', 'ci', 'ci-e2e'];

export function dramaE2eFixturesEnabled(): boolean {
  const runtimeEnvironment = process.env.NOVELHUB_RUNTIME_ENV ?? process.env.NODE_ENV;
  // Production deployments must not enable fixtures; the ci-e2e runtime is set only
  // by the Playwright workflow for the standalone smoke-test server.
  if (process.env.NODE_ENV === 'production' && runtimeEnvironment !== 'ci-e2e') return false;
  if (process.env.NOVELHUB_E2E_DRAMA_FIXTURES !== '1') return false;

  return allowedRuntimeEnvironments.some((allowed) => allowed === runtimeEnvironment);
}
