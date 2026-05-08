import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AppService, type HealthResponse } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Skip the global ThrottlerGuard so monitoring probes (Railway healthcheck,
  // UptimeRobot, Docker HEALTHCHECK) never get throttled. The endpoint is
  // a SELECT 1 — there's nothing to abuse here.
  @SkipThrottle()
  @Get('health')
  @ApiOperation({
    summary: 'Liveness + readiness probe (DB ping). Used by Railway, Docker, UptimeRobot.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        app: 'NovelHub',
        status: 'ok',
        db: 'ok',
        uptimeSeconds: 0,
        timestamp: '2026-05-08T00:00:00.000Z',
      },
    },
  })
  getHealth(): Promise<HealthResponse> {
    return this.appService.getHealth();
  }
}
