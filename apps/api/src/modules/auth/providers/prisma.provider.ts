import type { Provider } from '@nestjs/common';
import { prisma } from '@novelhub/db';

import { PRISMA } from '../auth.constants';

/**
 * Provides the shared Prisma client singleton from `@novelhub/db`.
 * Tests override this token with an in-memory or stubbed client.
 */
export const PrismaProvider: Provider = {
  provide: PRISMA,
  useValue: prisma,
};
