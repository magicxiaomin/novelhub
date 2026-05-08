// Vercel Cron trigger for the re-engagement push notification sweep.
// Vercel calls this endpoint per the schedule in `vercel.json`. The
// business logic (finding users, sending pushes, advisory-lock leader
// election) is unchanged in `NotificationsService.sendReEngagement()` —
// this file only wires the cron tick to that method.
//
// Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` if the
// CRON_SECRET env is set. We require it in production so randoms can't
// trigger pushes by hitting the URL.

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
    await notifications.sendReEngagement();
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}
