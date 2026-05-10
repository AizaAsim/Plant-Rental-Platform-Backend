import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import DatabaseModule from '../../database/database.module';
import { InternalJobsModule } from '../app/internal-jobs/internal-jobs.module';
import CronService from './cron.service';

@Module({
    imports: [ScheduleModule.forRoot(), DatabaseModule, InternalJobsModule],
    providers: [CronService],
})
export default class CronModule {}
