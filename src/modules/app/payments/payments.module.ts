import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { RolesGuard } from "../auth/guard/roles.guard";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { VendorFinancesController } from "./vendor-finances.controller";
import { GardenerFinancesController } from "./gardener-finances.controller";
import { BankDetailsController } from "./bank-details.controller";

@Module({
  imports: [PrismaModule],
  controllers: [
    PaymentsController,
    VendorFinancesController,
    GardenerFinancesController,
    BankDetailsController,
  ],
  providers: [PaymentsService, RolesGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}
