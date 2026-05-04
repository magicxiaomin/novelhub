import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AppService, type HealthResponse } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check API health' })
  @ApiOkResponse({
    schema: {
      example: {
        app: 'NovelHub',
        status: 'ok',
      },
    },
  })
  getHealth(): HealthResponse {
    return this.appService.getHealth();
  }
}
