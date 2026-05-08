import { Test } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  it('delegates health checks to the service', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getHealth: async () => ({
              app: 'NovelHub',
              status: 'ok',
              db: 'ok',
              uptimeSeconds: 1,
              timestamp: '2026-05-08T00:00:00.000Z',
            }),
          },
        },
      ],
    }).compile();

    await expect(moduleRef.get(AppController).getHealth()).resolves.toMatchObject({
      app: 'NovelHub',
      status: 'ok',
      db: 'ok',
    });
  });
});
