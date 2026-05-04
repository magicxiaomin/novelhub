import { Injectable } from '@nestjs/common';
import { APP_NAME } from '@novelhub/shared';

export interface HealthResponse {
  app: typeof APP_NAME;
  status: 'ok';
}

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      app: APP_NAME,
      status: 'ok',
    };
  }
}
