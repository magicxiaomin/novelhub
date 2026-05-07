import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { FbCapiService } from './fb-capi.service';
import { FbPurchaseEventPublisher } from './publishers/fb-purchase-event.publisher';

@Global()
@Module({
  imports: [AuthModule],
  providers: [FbCapiService, FbPurchaseEventPublisher],
  exports: [FbCapiService, FbPurchaseEventPublisher],
})
export class FbCapiModule {}
