import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import RedisModule from "./core/cache/redis.module";
import DatabaseModule from "./database/database.module";
import CronModule from "./modules/cron/cron.module";
import QueueModule from "./modules/queue/queue.module";
import EmailModule from "./modules/email/email.module";
import OAuthModule from "./modules/oauth/oauth.module";
import { HttpExceptionFilter } from "./core/exceptions/http.exception";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AuthModule } from "./modules/app/auth/auth.module";
import { UsersModule } from "./modules/app/users/users.module";
import { PlantsModule } from "./modules/app/plants/plants.module";
import { NurseriesModule } from "./modules/app/nurseries/nurseries.module";
import { RentalsModule } from "./modules/app/rentals/rentals.module";
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    RedisModule,
    DatabaseModule,
    AuthModule,
    PlantsModule,
    NurseriesModule,
    RentalsModule,
    UsersModule,
    CronModule,
    QueueModule,
    EmailModule,
    OAuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
