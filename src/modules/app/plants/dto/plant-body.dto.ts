import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString, IsOptional, IsNumber, IsBoolean,
  IsEnum, IsArray, IsUrl, Min, MinLength,
  IsInt, IsPositive, ValidateNested,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { MaintenanceLevel, SunlightRequirement, WaterFrequency } from "@prisma/client";

// ─── Image item used inside CreatePlantDto ────────────────────────────────────

export class PlantImageItemDto {
  @ApiProperty({ example: "https://cdn.example.com/plant1.jpg" })
  @IsUrl()
  image_url: string;

  @ApiPropertyOptional({ example: true, description: "Set as primary image" })
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @ApiPropertyOptional({ example: 0, description: "Display order index" })
  @IsOptional()
  @IsInt()
  @Min(0)
  display_order?: number;
}

// ─── Create Plant ─────────────────────────────────────────────────────────────

export class CreatePlantDto {
  @ApiProperty({ example: "Monstera Deliciosa" })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: "clh1234567890abcdef", description: "Category ID" })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({ example: "Monstera deliciosa" })
  @IsOptional()
  @IsString()
  scientific_name?: string;

  @ApiPropertyOptional({ example: "A beautiful indoor plant with split leaves" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "Water when top 2cm of soil is dry." })
  @IsOptional()
  @IsString()
  care_instructions?: string;

  @ApiPropertyOptional({ enum: SunlightRequirement, example: SunlightRequirement.MEDIUM })
  @IsOptional()
  @IsEnum(SunlightRequirement)
  sunlight_requirement?: SunlightRequirement;

  @ApiPropertyOptional({ enum: WaterFrequency })
  @IsOptional()
  @IsEnum(WaterFrequency)
  water_frequency?: WaterFrequency;

  @ApiPropertyOptional({ enum: MaintenanceLevel, example: MaintenanceLevel.LOW })
  @IsOptional()
  @IsEnum(MaintenanceLevel)
  maintenance_level?: MaintenanceLevel;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_indoor?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  is_pet_friendly?: boolean;

  @ApiPropertyOptional({ example: 60, description: "Plant height in cm" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  height_cm?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  pot_included?: boolean;

  @ApiPropertyOptional({ example: 100, description: "Daily rent price in PKR" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rent_price_daily?: number;

  @ApiPropertyOptional({ example: 500, description: "Weekly rent price in PKR" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rent_price_weekly?: number;

  @ApiPropertyOptional({ example: 1500, description: "Monthly rent price in PKR (required if is_available_for_rent is true)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rent_price_monthly?: number;

  @ApiPropertyOptional({ example: 2500, description: "Buy price in PKR (required if is_available_for_sale is true)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  buy_price?: number;

  @ApiPropertyOptional({ example: 1000, description: "Security deposit for rental", default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deposit_amount?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_available_for_rent?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_available_for_sale?: boolean;

  @ApiProperty({ example: 10, description: "Initial stock quantity" })
  @IsInt()
  @Min(0)
  stock_quantity: number;

  @ApiPropertyOptional({ example: 7, description: "Minimum rental days", default: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  min_rent_days?: number;

  @ApiPropertyOptional({ example: 365, description: "Maximum rental days", default: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  max_rent_days?: number;

  @ApiProperty({
    type: [PlantImageItemDto],
    description: "At least one image is required",
    example: [{ image_url: "https://cdn.example.com/plant1.jpg", is_primary: true, display_order: 0 }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlantImageItemDto)
  images: PlantImageItemDto[];

  @ApiPropertyOptional({
    example: ["air-purifying", "low-light"],
    type: [String],
    description: "Tag names — created if they don't exist",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

// ─── Update Plant (all fields optional, same snake_case keys) ─────────────────

export class UpdatePlantDto {
  @ApiPropertyOptional({ example: "Monstera Deliciosa" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: "clh1234567890abcdef" })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({ example: "Monstera deliciosa" })
  @IsOptional()
  @IsString()
  scientific_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  care_instructions?: string;

  @ApiPropertyOptional({ enum: SunlightRequirement })
  @IsOptional()
  @IsEnum(SunlightRequirement)
  sunlight_requirement?: SunlightRequirement;

  @ApiPropertyOptional({ enum: WaterFrequency })
  @IsOptional()
  @IsEnum(WaterFrequency)
  water_frequency?: WaterFrequency;

  @ApiPropertyOptional({ enum: MaintenanceLevel })
  @IsOptional()
  @IsEnum(MaintenanceLevel)
  maintenance_level?: MaintenanceLevel;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_indoor?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  is_pet_friendly?: boolean;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  height_cm?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  pot_included?: boolean;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rent_price_daily?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rent_price_weekly?: number;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rent_price_monthly?: number;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  buy_price?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deposit_amount?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_available_for_rent?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_available_for_sale?: boolean;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock_quantity?: number;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  min_rent_days?: number;

  @ApiPropertyOptional({ example: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  max_rent_days?: number;

  @ApiPropertyOptional({ example: true, description: "Toggle plant visibility" })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

// ─── Bulk Update ──────────────────────────────────────────────────────────────

export class BulkUpdatesFieldsDto {
  @ApiPropertyOptional({ example: true, description: "Activate or deactivate all selected plants" })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    example: 10,
    description: "Adjust all prices by this percentage (positive = increase, negative = decrease)",
  })
  @IsOptional()
  @IsNumber()
  price_adjustment_percent?: number;
}

export class BulkUpdateDto {
  @ApiProperty({
    example: ["clh111...", "clh222...", "clh333..."],
    type: [String],
    description: "IDs of plants to update — all must belong to the vendor",
  })
  @IsArray()
  @IsString({ each: true })
  plant_ids: string[];

  @ApiProperty({ type: BulkUpdatesFieldsDto })
  @ValidateNested()
  @Type(() => BulkUpdatesFieldsDto)
  updates: BulkUpdatesFieldsDto;
}

// ─── Update Stock ─────────────────────────────────────────────────────────────

export class UpdateStockDto {
  @ApiPropertyOptional({
    example: 15,
    description: "Set absolute stock value. Use this OR adjustment, not both.",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock_quantity?: number;

  @ApiPropertyOptional({
    example: -3,
    description: "Relative adjustment (positive = add, negative = subtract). Use this OR stock_quantity.",
  })
  @IsOptional()
  @IsInt()
  adjustment?: number;
}

// ─── Add Images ───────────────────────────────────────────────────────────────

export class AddPlantImagesDto {
  @ApiProperty({
    type: [PlantImageItemDto],
    example: [
      { image_url: "https://cdn.example.com/plant-front.jpg", is_primary: false, display_order: 1 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlantImageItemDto)
  images: PlantImageItemDto[];
}

// ─── Update Pricing ───────────────────────────────────────────────────────────

export class UpdatePricingDto {
  @ApiPropertyOptional({ example: 100, description: "Daily rent price in PKR" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rent_price_daily?: number;

  @ApiPropertyOptional({ example: 500, description: "Weekly rent price in PKR" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rent_price_weekly?: number;

  @ApiPropertyOptional({ example: 1500, description: "Monthly rent price in PKR" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rent_price_monthly?: number;

  @ApiPropertyOptional({ example: 2500, description: "Buy price in PKR" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  buy_price?: number;

  @ApiPropertyOptional({ example: 1000, description: "Security deposit for rental" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deposit_amount?: number;
}

// ─── Create Review ────────────────────────────────────────────────────────────

export class CreateReviewDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @IsPositive()
  rating: number;

  @ApiPropertyOptional({ example: "Beautiful plant!" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: "Arrived in perfect condition, very healthy." })
  @IsOptional()
  @IsString()
  @MinLength(10)
  comment?: string;

  @ApiPropertyOptional({
    example: "clh_order_123",
    description: "Order ID for verified purchase badge",
  })
  @IsOptional()
  @IsString()
  order_id?: string;

  @ApiPropertyOptional({
    example: ["https://cdn.example.com/my-plant.jpg"],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];
}