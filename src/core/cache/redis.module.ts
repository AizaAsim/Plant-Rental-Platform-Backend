import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { redisStore } from 'cache-manager-redis-yet';
import AppConfig from '../../configs/app.config';
import RedisService from './redis.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: redisStore,
        host: AppConfig.REDIS.HOST,
        port: AppConfig.REDIS.PORT,
      }),
    }),
  ],
  exports: [RedisService],
  providers: [RedisService],
})
export default class RedisModule {}
