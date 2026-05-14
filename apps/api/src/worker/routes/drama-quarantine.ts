import type { Context, Env } from 'hono';

import { isWorkerNovelsOnlyProductMode } from '../productMode';
import type { WorkerEnv } from '../services/auth-factory';

export const DRAMA_QUARANTINE_CODE = 'DRAMA_QUARANTINED';
export const DRAMA_QUARANTINE_HEADER = 'x-novelhub-quarantine';

const DRAMA_QUARANTINE_PAYLOAD = {
  code: DRAMA_QUARANTINE_CODE,
  message: 'Short-drama endpoints are quarantined in novels-only mode.',
} as const;

type DramaQuarantineEnv = Env & { Bindings: WorkerEnv };

export const isDramaQuarantined = (env?: WorkerEnv): boolean => isWorkerNovelsOnlyProductMode(env);

export const dramaQuarantineResponse = <T extends DramaQuarantineEnv>(c: Context<T>): Response => {
  c.header(DRAMA_QUARANTINE_HEADER, 'drama');
  return c.json(DRAMA_QUARANTINE_PAYLOAD, 410);
};
