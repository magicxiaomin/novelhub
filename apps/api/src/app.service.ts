import { Inject, Injectable, Logger } from '@nestjs/common';
import APP_NAME from '@novelhub/shared';
import type { PrismaClient } from '@prisma/client';

import { PRISMA } from './modules/auth/auth.constants';

export interface HealthResponse {
  app: typeof APP_NAME;
  // `ok` when the SELECT 1 round-trip succeeds, `degraded` when it fails.
  // Probes that only check liveness can ignore `status`; readiness probes
  // (Railway, UptimeRobot keyword match) should require `status: 'ok'`.
  status: 'ok' | 'degraded';
  db: 'ok' | 'fail';
  uptimeSeconds: number;
  timestamp: string;
}

const STARTED_AT = Date.now();

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  getApplicationName(): typeof APP_NAME {
    return APP_NAME;
  }

  async getHealth(): Promise<HealthResponse> {
    let db: 'ok' | 'fail' = 'fail';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'ok';
    } catch (err) {
      this.logger.warn(`Health DB ping failed: ${(err as Error).message}`);
    }
    return {
      app: this.getApplicationName(),
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
