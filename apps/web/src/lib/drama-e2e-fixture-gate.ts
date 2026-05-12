export function dramaE2eFixturesEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.NOVELHUB_E2E_DRAMA_FIXTURES === '1';
}
