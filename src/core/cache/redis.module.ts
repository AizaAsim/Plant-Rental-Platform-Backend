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
        const reconnectStrategy = (retries: number) => {
          if (retries > 20) {
            return new Error('Redis reconnect limit exceeded');
          }
          return Math.min(retries * 100, 3000);
        };
        const password = AppConfig.REDIS.PASSWORD
          ? { password: AppConfig.REDIS.PASSWORD }
          : {};
        const store = await redisStore(
          AppConfig.REDIS.USE_TLS
            ? {
                socket: { host, port, tls: true, reconnectStrategy },
                ...password,
              }
            : {
                socket: { host, port, reconnectStrategy },
                ...password,
              },
        );
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
