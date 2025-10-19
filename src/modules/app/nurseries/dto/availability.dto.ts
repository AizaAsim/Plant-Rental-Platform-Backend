import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PlantAvailabilityDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  plantId: string;

  @ApiProperty({ example: "Monstera Deliciosa" })
  plantName: string;

  @ApiProperty({ example: true })
  isAvailable: boolean;

  @ApiProperty({ example: 8 })
  availableQuantity: number;

  @ApiPropertyOptional({
    example: "2024-01-15",
    description: "Next restock date",
  })
  nextRestockDate?: string;

  @ApiPropertyOptional({
    example: 3,
    description: "Reserved for pending orders",
  })
  reservedQuantity?: number;

  @ApiPropertyOptional({ example: 2, description: "Currently in rental" })
  inRentalQuantity?: number;

  @ApiProperty({
    example: "IN_STOCK",
    enum: ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "DISCONTINUED"],
  })
  status: string;

  @ApiPropertyOptional({
    example: ["2024-01-10", "2024-01-12"],
    description: "Dates when plant will be available",
  })
  availableDates?: string[];
}

export class NurseryAvailabilityResponseDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  nurseryId: string;

  @ApiProperty({ example: "Green Paradise Nursery" })
  nurseryName: string;

  @ApiProperty({ type: [PlantAvailabilityDto] })
  plants: PlantAvailabilityDto[];

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  lastUpdated: Date;

  @ApiProperty({ example: true })
  isOpen: boolean;

  @ApiPropertyOptional({ example: "Open until 8:00 PM" })
  currentStatus?: string;
}
