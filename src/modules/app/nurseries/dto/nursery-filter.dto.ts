import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsNumber,
  IsString,
  IsBoolean,
  Min,
  Max,
  IsEnum,
  IsArray,
} from "class-validator";
import { Type, Transform } from "class-transformer";

export class NurseryFilterDto {
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
    description: "Filter by city",
    example: "Karachi",
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: "Filter by state",
    example: "Sindh",
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: "Search query for nursery name",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: "Minimum rating filter",
    minimum: 0,
    maximum: 5,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({
    description: "Maximum delivery range in km",
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxDeliveryRange?: number;

  @ApiPropertyOptional({
    description: "Filter by verified status",
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: "Filter by active status",
    type: Boolean,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({
    description: "Sort by field",
    enum: ["name", "rating", "totalReviews", "createdAt", "distance"],
    default: "rating",
  })
  @IsOptional()
  @IsString()
  sortBy?: string = "rating";

  @ApiPropertyOptional({
    description: "Sort order",
    enum: ["asc", "desc"],
    default: "desc",
  })
  @IsOptional()
  @IsEnum(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "desc";

  @ApiPropertyOptional({
    description: "User latitude for distance calculation",
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    description: "User longitude for distance calculation",
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    description: "Service areas (zip codes)",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.split(",").map((v) => v.trim());
    }
    return value;
  })
  serviceAreas?: string[];
}
