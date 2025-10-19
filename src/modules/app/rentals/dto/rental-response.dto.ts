import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RentalResponseDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  id: string;

  @ApiProperty({ example: "clh1234567890abcdef" })
  userId: string;

  @ApiProperty({ example: "clh1234567890abcdef" })
  nurseryId: string;

  @ApiProperty({ example: "clh1234567890abcdef" })
  plantId: string;

  @ApiProperty({ example: 4, description: "Duration in weeks" })
  duration: number;

  @ApiProperty({ example: "PREMIUM", enum: ["BASIC", "PREMIUM"] })
  serviceType: string;

  @ApiProperty({
    example: "ACTIVE",
    enum: [
      "PENDING",
      "CONFIRMED",
      "DELIVERED",
      "ACTIVE",
      "RETURNED",
      "COMPLETED",
      "CANCELLED",
      "EXTENDED",
    ],
  })
  status: string;

  @ApiProperty({ example: 500 })
  rentalPrice: number;

  @ApiProperty({ example: 200 })
  maintenancePrice: number;

  @ApiProperty({ example: 1000 })
  securityDeposit: number;

  @ApiProperty({ example: 3000 })
  totalAmount: number;

  @ApiProperty({ example: "2024-01-15T00:00:00.000Z" })
  startDate: Date;

  @ApiProperty({ example: "2024-02-12T00:00:00.000Z" })
  endDate: Date;

  @ApiPropertyOptional({ example: "2024-01-15T10:00:00.000Z" })
  deliveredAt?: Date;

  @ApiPropertyOptional({ example: "2024-02-12T10:00:00.000Z" })
  returnedAt?: Date;

  @ApiProperty({ description: "Delivery address" })
  deliveryAddress: any;

  @ApiPropertyOptional({ description: "Pickup address" })
  pickupAddress?: any;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  updatedAt: Date;

  @ApiPropertyOptional({ description: "Plant details" })
  plant?: any;

  @ApiPropertyOptional({ description: "Nursery details" })
  nursery?: any;

  @ApiPropertyOptional({ description: "User details" })
  user?: any;

  @ApiPropertyOptional({ description: "Maintenance schedule" })
  maintenanceSchedule?: any;

  @ApiPropertyOptional({ description: "Payments" })
  payments?: any[];

  @ApiPropertyOptional({ description: "Delivery information" })
  delivery?: any;
}

export class RentalListResponseDto {
  @ApiProperty({ type: [RentalResponseDto] })
  data: RentalResponseDto[];

  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNext: boolean;

  @ApiProperty({ example: false })
  hasPrevious: boolean;
}

export class AvailabilityResponseDto {
  @ApiProperty({ example: true })
  isAvailable: boolean;

  @ApiProperty({ example: "clh1234567890abcdef" })
  plantId: string;

  @ApiProperty({ example: "Monstera Deliciosa" })
  plantName: string;

  @ApiProperty({ example: 5 })
  availableQuantity: number;

  @ApiProperty({ example: 2 })
  requestedQuantity: number;

  @ApiProperty({ example: "2024-01-15" })
  startDate: string;

  @ApiProperty({ example: "2024-02-12" })
  endDate: string;

  @ApiPropertyOptional({
    example: ["2024-01-16", "2024-01-20"],
    description: "Conflicting dates if not available",
  })
  conflictingDates?: string[];

  @ApiPropertyOptional({
    example: "2024-02-15",
    description: "Next available date if not available",
  })
  nextAvailableDate?: string;

  @ApiProperty({ example: 2000, description: "Estimated rental cost" })
  estimatedCost: number;

  @ApiProperty({ example: 1000, description: "Required security deposit" })
  securityDeposit: number;
}
