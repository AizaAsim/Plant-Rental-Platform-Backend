import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import DatabaseService from '../../database/database.service';

@Injectable()
export default class CronService {
    constructor(private _dbService: DatabaseService) {}

    @Cron(CronExpression.EVERY_HOUR, { name: 'test' })
    HandleTestMessage() {
        console.log("'===> Generated from test cron <===', '[CRON]'")
    }
}
