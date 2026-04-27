import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { IdempotencyService } from "./idempotency.service";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class ContractCommonModule {}
