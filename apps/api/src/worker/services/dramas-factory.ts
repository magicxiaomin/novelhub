import type { PrismaClient } from '@prisma/client';

import { DramasService } from '../../modules/drama/dramas.service';
import type { WorkerEnv } from './auth-factory';

export function makeDramasService(env: WorkerEnv, prisma: PrismaClient): DramasService {
  void env;
  return new DramasService({ prisma });
}
