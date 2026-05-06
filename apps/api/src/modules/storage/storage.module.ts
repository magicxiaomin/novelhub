import { Global, Module, type Provider } from '@nestjs/common';

import { R2StorageClient } from './r2.client';
import { STORAGE_CLIENT } from './storage.constants';

const StorageProvider: Provider = {
  provide: STORAGE_CLIENT,
  useFactory: (): R2StorageClient => new R2StorageClient(),
};

@Global()
@Module({
  providers: [StorageProvider],
  exports: [StorageProvider],
})
export class StorageModule {}
