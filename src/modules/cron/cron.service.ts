import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InternalJobsService } from "../app/internal-jobs/internal-jobs.service";

@Injectable()
export default class CronService {
  private readonly log = new Logger(CronService.name);

  constructor(private readonly internalJobs: InternalJobsService) {}

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
}
