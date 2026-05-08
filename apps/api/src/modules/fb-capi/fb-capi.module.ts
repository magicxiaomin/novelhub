import { Global, Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { PRISMA } from '../auth/auth.constants';
import { AuthModule } from '../auth/auth.module';

import { FbCapiService } from './fb-capi.service';
import { FbPurchaseEventPublisher } from './publishers/fb-purchase-event.publisher';

@Global()
@Module({
  imports: [AuthModule],
  providers: [
    {
      provide: FbCapiService,
      useFactory: (prisma: PrismaClient): FbCapiService =>
        new FbCapiService({
          prisma,
          pixelId: process.env.NEXT_PUBLIC_FB_PIXEL_ID,
          accessToken: process.env.FB_CAPI_ACCESS_TOKEN,
          testEventCode: process.env.FB_TEST_EVENT_CODE,
          isProduction: process.env.NODE_ENV === 'production',
        }),
      inject: [PRISMA],
    },
    {
      provide: FbPurchaseEventPublisher,
      useFactory: (prisma: PrismaClient, fbCapi: FbCapiService): FbPurchaseEventPublisher =>
        new FbPurchaseEventPublisher({ prisma, fbCapi }),
      inject: [PRISMA, FbCapiService],
    },
  ],
  exports: [FbCapiService, FbPurchaseEventPublisher],
})
export class FbCapiModule {}
