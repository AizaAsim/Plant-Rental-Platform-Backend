import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
import { ServiceType } from "@prisma/client";

export class CreateRentalDto {
  @ApiProperty({
    example: "clh1234567890abcdef",
    description: "Plant ID to rent",
  })
  @IsString()
  @IsUUID()
  plantId: string;

  @ApiProperty({
    example: "clh1234567890abcdef",
    description: "Nursery ID",
  })
  @IsString()
  @IsUUID()
  nurseryId: string;

  @ApiProperty({
    example: 4,
    description: "Rental duration in weeks",
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  duration: number;

  @ApiProperty({
    enum: ServiceType,
    example: "PREMIUM",
    description: "Service type for maintenance",
  })
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ApiProperty({
    example: "2024-01-15",
    description: "Rental start date",
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    example: "clh1234567890abcdef",
    description: "Delivery address ID",
  })
  @IsOptional()
  @IsString()
  deliveryAddressId?: string;

  @ApiPropertyOptional({
    description: "Custom delivery address if not using saved address",
  })
  @IsOptional()
  customDeliveryAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };

  @ApiPropertyOptional({
    example: "Please deliver between 2-4 PM",
    description: "Special delivery instructions",
  })
  @IsOptional()
  @IsString()
  deliveryInstructions?: string;

  @ApiPropertyOptional({
    example: true,
    description: "Whether to include maintenance service",
  })
  @IsOptional()
  @IsBoolean()
  includeMaintenance?: boolean;

  @ApiPropertyOptional({
    example: 2,
    description: "Maintenance visits per week",
    minimum: 1,
    maximum: 3,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3)
  maintenanceFrequency?: number;
}
