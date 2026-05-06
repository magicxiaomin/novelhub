import { Global, Module, type Provider } from '@nestjs/common';

import { CACHE_CLIENT } from './cache.constants';
import { RedisCacheClient } from './redis.client';

const CacheProvider: Provider = {
  provide: CACHE_CLIENT,
  useFactory: (): RedisCacheClient => new RedisCacheClient(),
};

@Global()
@Module({
  providers: [CacheProvider],
  exports: [CacheProvider],
})
export class CacheModule {}
