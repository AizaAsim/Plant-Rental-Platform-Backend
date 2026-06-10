import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
  IsUUID,
} from "class-validator";
import { Type } from "class-transformer";

export class VendorPackageDeliverySlotDto {
  @ApiProperty({ example: "2026-06-15", description: "Calendar date (YYYY-MM-DD), not day_of_week" })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" })
  date: string;

  @ApiProperty({ example: "09:00" })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "time_from must be HH:MM" })
  time_from: string;

  @ApiProperty({ example: "12:00" })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "time_to must be HH:MM" })
  time_to: string;

  @ApiProperty({ example: 5, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity: number;
}

export class VendorPackagePlantLineDto {
  @ApiProperty({ example: "00000000-0000-4000-8000-000000000001" })
  @IsString()
  @MinLength(1)
  plant_id: string;

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number;
}

export class CreateVendorPackageDto {
  @ApiProperty({ example: "Corporate corner office" })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: "STANDARD", description: "Opaque tier label for UX / reporting" })
  @IsString()
  @MinLength(1)
  tier: string;

  @ApiPropertyOptional({ example: "Up to N plants with monthly swaps" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 12, minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  max_plant_count: number;

  @ApiProperty({ example: 30 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  rental_duration_days: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  includes_maintenance: boolean;

  @ApiPropertyOptional({ example: 2, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maintenance_visits_per_month?: number;

  @ApiProperty({ example: 4999.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  base_price: number;

  @ApiPropertyOptional({ example: 500, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deposit_amount?: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  allows_installments?: boolean;

  @ApiPropertyOptional({ description: "JSON installment options structure" })
  @IsOptional()
  installment_options?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "JSON add-on catalogue" })
  @IsOptional()
  add_ons?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Date-specific delivery capacity slots (date, time_from, time_to, capacity)",
    type: [VendorPackageDeliverySlotDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorPackageDeliverySlotDto)
  delivery_slots?: VendorPackageDeliverySlotDto[];

  @ApiPropertyOptional({
    type: [VendorPackagePlantLineDto],
    description: "Inventory plants assigned to this package (references only; no stock change)",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorPackagePlantLineDto)
  plants?: VendorPackagePlantLineDto[];

  @ApiPropertyOptional({
    type: [String],
    description: "Alias for plants[] with quantity 1 per id",
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  plant_ids?: string[];

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateVendorPackageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  max_plant_count?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  rental_duration_days?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includes_maintenance?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maintenance_visits_per_month?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  base_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deposit_amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allows_installments?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  installment_options?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  add_ons?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [VendorPackageDeliverySlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorPackageDeliverySlotDto)
  delivery_slots?: VendorPackageDeliverySlotDto[];

  @ApiPropertyOptional({ type: [VendorPackagePlantLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorPackagePlantLineDto)
  plants?: VendorPackagePlantLineDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  plant_ids?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class SetVendorPackagePlantsDto {
  @ApiPropertyOptional({ type: [VendorPackagePlantLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorPackagePlantLineDto)
  plants?: VendorPackagePlantLineDto[];

  @ApiPropertyOptional({ type: [String], description: "Alias: each id gets quantity 1" })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  plant_ids?: string[];
}
