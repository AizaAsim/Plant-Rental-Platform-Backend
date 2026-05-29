import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsOptional, IsString, Min, MinLength, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class VendorPackagePlantLineDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  @IsString()
  @MinLength(1)
  plant_id: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;
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

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    type: [VendorPackagePlantLineDto],
    description: "Plants allocated to this package (template only — does not reduce inventory)",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorPackagePlantLineDto)
  plants?: VendorPackagePlantLineDto[];
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ type: [VendorPackagePlantLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorPackagePlantLineDto)
  plants?: VendorPackagePlantLineDto[];
}
