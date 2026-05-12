const allowedRuntimeEnvironments = ['development', 'test', 'ci', 'ci-e2e'];

export function dramaE2eFixturesEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.NOVELHUB_E2E_DRAMA_FIXTURES !== '1') return false;

  const runtimeEnvironment = process.env.NOVELHUB_RUNTIME_ENV ?? process.env.NODE_ENV;
  return allowedRuntimeEnvironments.some((allowed) => allowed === runtimeEnvironment);
}
