import { ApiPropertyOptional } from "@nestjs/swagger";
import { RentalStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsString,
  IsNumber,
  IsEnum,
  IsDateString,
  IsOptional,
  Min,
  IsBoolean,
  IsUUID,
  Max,
} from "class-validator";

export class RentalFilterDto {
  @ApiPropertyOptional({
    description: "Page number",
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Items per page",
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: RentalStatus,
    description: "Filter by status",
  })
  @IsOptional()
  @IsEnum(RentalStatus)
  status?: RentalStatus;

  @ApiPropertyOptional({
    description: "Filter by nursery ID",
  })
  @IsOptional()
  @IsString()
  nurseryId?: string;

  @ApiPropertyOptional({
    description: "Filter by plant ID",
  })
  @IsOptional()
  @IsString()
  plantId?: string;

  @ApiPropertyOptional({
    description: "Filter rentals starting after this date",
  })
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional({
    description: "Filter rentals starting before this date",
  })
  @IsOptional()
  @IsDateString()
  startDateTo?: string;

  @ApiPropertyOptional({
    description: "Sort by field",
    enum: ["createdAt", "startDate", "endDate", "totalAmount"],
    default: "createdAt",
  })
  @IsOptional()
  @IsString()
  sortBy?: string = "createdAt";

  @ApiPropertyOptional({
    description: "Sort order",
    enum: ["asc", "desc"],
    default: "desc",
  })
  @IsOptional()
  @IsEnum(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "desc";
}
