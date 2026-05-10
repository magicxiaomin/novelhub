import { Global, Module, type Provider } from '@nestjs/common';

import { LocalStorageClient } from './local.client';
import { R2StorageClient } from './r2.client';
import { STORAGE_CLIENT, type StorageClient } from './storage.constants';

const StorageProvider: Provider = {
  provide: STORAGE_CLIENT,
  useFactory: (): StorageClient =>
    process.env.R2_ACCOUNT_ID ? new R2StorageClient() : new LocalStorageClient(),
};

@Global()
@Module({
  providers: [StorageProvider],
  exports: [StorageProvider],
})
export class StorageModule {}
