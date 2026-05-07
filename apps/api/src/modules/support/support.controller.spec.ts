import { Test, type TestingModule } from '@nestjs/testing';

import { SupportController } from './support.controller';
import { SupportService } from './support.service';

describe('SupportController', () => {
  it('contact: returns delivered false when Resend env is unset', async () => {
    const originalEnv = { ...process.env };
    delete process.env.RESEND_API_KEY;
    delete process.env.SUPPORT_EMAIL;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [SupportService],
    }).compile();
    const controller = module.get(SupportController);

    await expect(
      controller.contact({
        name: 'Reader',
        email: 'reader@example.com',
        subject: 'Help',
        body: 'Question',
      }),
    ).resolves.toEqual({ delivered: false });
    process.env = originalEnv;
  });
});
