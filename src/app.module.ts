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
import { PackagesModule } from "./modules/app/packages/packages.module";
import { CartModule } from "./modules/app/cart/cart.module";
import { OrdersModule } from "./modules/app/orders/orders.module";
import { GardenersModule } from "./modules/app/gardeners/gardeners.module";
import { BookingsModule } from "./modules/app/bookings/bookings.module";
import { TasksModule } from "./modules/app/tasks/tasks.module";
import { PaymentsModule } from "./modules/app/payments/payments.module";
import { NotificationsModule } from "./modules/app/notifications/notifications.module";
import { MediaModule } from "./modules/app/media/media.module";
import { AdminModule } from "./modules/app/admin/admin.module";
import { AnalyticsModule } from "./modules/app/analytics/analytics.module";
import { ReviewsDisputesModule } from "./modules/app/reviews-disputes/reviews-disputes.module";
import { AiModule } from "./modules/app/ai/ai.module";
import { PreferencesModule } from "./modules/app/preferences/preferences.module";
import { ContractCommonModule } from "./common/contract/contract-common.module";
import { VendorPackagesModule } from "./modules/app/vendor-packages/vendor-packages.module";
import { FreelanceJobsModule } from "./modules/app/freelance-jobs/freelance-jobs.module";
import { InternalJobsModule } from "./modules/app/internal-jobs/internal-jobs.module";
import { VendorOnboardingModule } from "./modules/app/vendor-onboarding/vendor-onboarding.module";
@Module({
  imports: [
    ContractCommonModule,
    EventEmitterModule.forRoot(),
    RedisModule,
    DatabaseModule,
    AuthModule,
    PlantsModule,
    NurseriesModule,
    RentalsModule,
    UsersModule,
    PackagesModule,
    CartModule,
    OrdersModule,
    GardenersModule,
    BookingsModule,
    TasksModule,
    PaymentsModule,
    NotificationsModule,
    MediaModule,
    AdminModule,
    AnalyticsModule,
    ReviewsDisputesModule,
    PreferencesModule,
    VendorPackagesModule,
    VendorOnboardingModule,
    FreelanceJobsModule,
    InternalJobsModule,
    AiModule,
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
