// Vercel Cron trigger for the subscription renewal reminder sweep.
// Mirror of `re-engagement.ts` — same auth gate, same NestJS bootstrap
// pattern, just routes to NotificationsService.sendRenewalReminders().

import './../../src/instrument';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { AppModule } from './../../src/app.module';
import { NotificationsService } from './../../src/modules/notifications/notifications.service';

let appPromise: Promise<NestExpressApplication> | null = null;

async function getApp(): Promise<NestExpressApplication> {
  if (!appPromise) {
    appPromise = NestFactory.create<NestExpressApplication>(AppModule, { logger: false }).then(
      async (app) => {
        await app.init();
        return app;
      },
    );
  }
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const expected = process.env.CRON_SECRET;
  if (expected && req.headers.authorization !== `Bearer ${expected}`) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const app = await getApp();
    const notifications = app.get(NotificationsService);
    await notifications.sendRenewalReminders();
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}
