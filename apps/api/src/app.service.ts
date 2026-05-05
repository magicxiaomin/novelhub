import { Injectable } from '@nestjs/common';
import { APP_NAME } from '@novelhub/shared';

export interface HealthResponse {
  app: typeof APP_NAME;
  status: 'ok';
}

@Injectable()
export class AppService {
  getApplicationName(): typeof APP_NAME {
    return APP_NAME;
  }

  getHealth(): HealthResponse {
    return {
      app: this.getApplicationName(),
      status: 'ok',
    };
  }
}
