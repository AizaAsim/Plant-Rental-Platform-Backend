import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsOptional, Min } from "class-validator";

export class InventoryItemDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  plantId: string;

  @ApiProperty({ example: "Monstera Deliciosa" })
  plantName: string;

  @ApiProperty({ example: "INDOOR" })
  category: string;

  @ApiProperty({ example: 10 })
  totalStock: number;

  @ApiProperty({ example: 8 })
  availableStock: number;

  @ApiProperty({ example: 2 })
  reservedStock: number;

  @ApiProperty({ example: 2500 })
  purchasePrice: number;

  @ApiProperty({ example: 500 })
  rentalPrice: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ example: "2024-01-01T00:00:00.000Z" })
  lastRestocked?: Date;

  @ApiPropertyOptional({ example: 5 })
  lowStockThreshold?: number;

  @ApiPropertyOptional({ example: false })
  isLowStock?: boolean;
}

export class UpdateInventoryDto {
  @ApiProperty({
    example: "clh1234567890abcdef",
    description: "Plant ID to update",
  })
  plantId: string;

  @ApiPropertyOptional({
    example: 15,
    description: "New total stock quantity",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalStock?: number;

  @ApiPropertyOptional({
    example: 12,
    description: "New available stock quantity",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  availableStock?: number;

  @ApiPropertyOptional({
    example: 2500,
    description: "Updated purchase price",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional({
    example: 500,
    description: "Updated rental price",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rentalPrice?: number;

  @ApiPropertyOptional({
    example: true,
    description: "Active status",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkUpdateInventoryDto {
  @ApiProperty({
    type: [UpdateInventoryDto],
    description: "Array of inventory updates",
  })
  updates: UpdateInventoryDto[];
}
