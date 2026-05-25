import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InternalJobsService } from "../app/internal-jobs/internal-jobs.service";
import { PenaltyService } from "../app/orders/penalty.service";

@Injectable()
export default class CronService {
  private readonly log = new Logger(CronService.name);

  constructor(
    private readonly internalJobs: InternalJobsService,
    private readonly penaltyService: PenaltyService
  ) {}

  @Cron(process.env.ORDER_EXPIRY_CRON_CRON ?? CronExpression.EVERY_10_MINUTES, {
    name: "order_expiry_sweep",
  })
  async orderExpirySweep() {
    if (process.env.ORDER_EXPIRY_CRON_ENABLED === "false") {
      return;
    }
    try {
      await this.internalJobs.runOrderExpirySweep();
    } catch (e) {
      this.log.warn(`order expiry sweep failed: ${e}`);
    }
  }

  @Cron(process.env.PENALTY_CRON_CRON ?? CronExpression.EVERY_DAY_AT_1AM, {
    name: "rental_penalty_sweep",
  })
  async rentalPenaltySweep() {
    if (process.env.PENALTY_CRON_ENABLED === "false") {
      return;
    }
    try {
      const result = await this.penaltyService.runDailyPenaltySweep(true);
      this.log.log(`penalty sweep: ${JSON.stringify(result)}`);
    } catch (e) {
      this.log.warn(`penalty sweep failed: ${e}`);
    }
  }
}
