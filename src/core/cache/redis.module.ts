import { CacheModule } from '@nestjs/cache-manager';
import { Logger, Module } from '@nestjs/common';
import { redisStore } from 'cache-manager-redis-yet';
import AppConfig from '../../configs/app.config';
import RedisService from './redis.service';

const redisCacheLogger = new Logger('RedisCache');

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => {
        const host = AppConfig.REDIS.HOST ?? '127.0.0.1';
        const port = AppConfig.REDIS.PORT || 6379;
        const store = await redisStore({
          socket: {
            host,
            port,
            reconnectStrategy(retries) {
              if (retries > 20) {
                return new Error('Redis reconnect limit exceeded');
              }
              return Math.min(retries * 100, 3000);
            },
          },
        });
        store.client.on('error', (err: Error) => {
          redisCacheLogger.warn(`Redis cache client error: ${err.message}`);
        });
        return { store };
      },
    }),
  ],
  exports: [RedisService],
  providers: [RedisService],
})
export default class RedisModule {}
