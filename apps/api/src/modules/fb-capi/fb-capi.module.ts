import { Global, Module } from '@nestjs/common';

import { PrismaProvider } from '../auth/providers/prisma.provider';

import { FbCapiService } from './fb-capi.service';
import { FbPurchaseEventPublisher } from './publishers/fb-purchase-event.publisher';

@Global()
@Module({
  providers: [PrismaProvider, FbCapiService, FbPurchaseEventPublisher],
  exports: [FbCapiService, FbPurchaseEventPublisher],
})
export class FbCapiModule {}
