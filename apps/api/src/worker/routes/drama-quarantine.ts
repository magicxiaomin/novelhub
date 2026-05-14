import type { Context, Env } from 'hono';

import type { WorkerEnv } from '../services/auth-factory';

export const DRAMA_DEPRECATED_CODE = 'DRAMA_DEPRECATED';
export const DRAMA_DEPRECATED_HEADER = 'x-novelhub-deprecated';

const DRAMA_DEPRECATED_PAYLOAD = {
  code: DRAMA_DEPRECATED_CODE,
  message: 'Short-drama endpoints are deprecated during the novels-only pivot.',
} as const;

type DramaDeprecatedEnv = Env & { Bindings: WorkerEnv };

export const dramaDeprecatedResponse = <T extends DramaDeprecatedEnv>(c: Context<T>): Response => {
  c.header(DRAMA_DEPRECATED_HEADER, 'drama');
  return c.json(DRAMA_DEPRECATED_PAYLOAD, 410);
};
