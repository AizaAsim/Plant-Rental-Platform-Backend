import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { PlantInventoryService } from "./plant-inventory.service";
import { InventoryController } from "./inventory.controller";

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController],
  providers: [PlantInventoryService],
  exports: [PlantInventoryService],
})
export class InventoryModule {}
