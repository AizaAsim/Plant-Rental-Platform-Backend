import { PartialType, OmitType } from "@nestjs/swagger";
import { CreateRentalDto } from "./create-rental.dto";
import { RentalStatus } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateRentalDto extends PartialType(
  OmitType(CreateRentalDto, ["plantId", "nurseryId", "startDate"] as const)
) {
  @ApiPropertyOptional({
    enum: RentalStatus,
    description: "Rental status",
  })
  @IsOptional()
  @IsEnum(RentalStatus)
  status?: RentalStatus;
}
