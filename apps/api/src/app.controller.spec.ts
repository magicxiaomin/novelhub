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
            getHealth: () => ({ app: 'NovelHub', status: 'ok' }),
          },
        },
      ],
    }).compile();

    expect(moduleRef.get(AppController).getHealth()).toEqual({
      app: 'NovelHub',
      status: 'ok',
    });
  });
});
