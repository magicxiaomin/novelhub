import { Hono } from 'hono';

import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import type { WorkerEnv } from '../services/auth-factory';
import { dramaDeprecatedResponse } from './drama-quarantine';

type Bindings = WorkerEnv;
type Variables = PrismaVariables & AuthVariables;

export const dramaProgressRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>().all(
  '*',
  (c) => dramaDeprecatedResponse(c),
);
