import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsString,
  Min,
  Max,
  IsArray,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import {
  PlantCategory,
  PlantSize,
  CareLevel,
  LightRequirement,
} from "@prisma/client";

export class PlantFilterDto {
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
    enum: PlantCategory,
    description: "Filter by category",
  })
  @IsOptional()
  @IsEnum(PlantCategory)
  category?: PlantCategory;

  @ApiPropertyOptional({
    enum: PlantSize,
    description: "Filter by size",
  })
  @IsOptional()
  @IsEnum(PlantSize)
  size?: PlantSize;

  @ApiPropertyOptional({
    enum: CareLevel,
    description: "Filter by care level",
  })
  @IsOptional()
  @IsEnum(CareLevel)
  careLevel?: CareLevel;

  @ApiPropertyOptional({
    enum: LightRequirement,
    description: "Filter by light requirement",
  })
  @IsOptional()
  @IsEnum(LightRequirement)
  lightRequirement?: LightRequirement;

  @ApiPropertyOptional({
    description: "Filter by pet-safe plants only",
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isPetSafe?: boolean;

  @ApiPropertyOptional({
    description: "Filter by indoor plants only",
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isIndoor?: boolean;

  @ApiPropertyOptional({
    description: "Filter by availability",
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional({
    description: "Minimum purchase price",
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: "Maximum purchase price",
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: "Minimum rental price per week",
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minRentalPrice?: number;

  @ApiPropertyOptional({
    description: "Maximum rental price per week",
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxRentalPrice?: number;

  @ApiPropertyOptional({
    description: "Nursery ID to filter by",
    type: String,
  })
  @IsOptional()
  @IsString()
  nurseryId?: string;

  @ApiPropertyOptional({
    description: "Show featured plants only",
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({
    description: "Sort by field",
    enum: ["price", "rentalPrice", "name", "createdAt", "popularity"],
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
