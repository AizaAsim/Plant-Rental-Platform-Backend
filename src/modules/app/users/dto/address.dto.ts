import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsNumber,
  IsNotEmpty,
} from "class-validator";

export class CreateAddressDto {
  @ApiPropertyOptional({
    example: "Home",
    description: "Address label",
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({
    example: "123 Main Street",
    description: "Address line 1",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(200)
  address_line1: string;

  @ApiPropertyOptional({
    example: "Apartment 4B",
    description: "Address line 2",
  })
  @IsOptional()
  @IsString()
  address_line2?: string;

  @ApiProperty({
    example: "Karachi",
    description: "City",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  city: string;

  @ApiProperty({
    example: "Sindh",
    description: "State or province",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  state: string;

  @ApiProperty({
    example: "75500",
    description: "Pincode",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{5,10}$/, {
    message: "Pincode must be 5-10 digits",
  })
  pincode: string;

  @ApiPropertyOptional({
    example: 24.8607,
    description: "Latitude",
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    example: 67.0011,
    description: "Longitude",
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    example: false,
    description: "Set as default address",
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class UpdateAddressDto {
  @ApiPropertyOptional({
    example: "Home",
    description: "Address label",
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    example: "123 Main Street",
    description: "Address line 1",
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  address_line1?: string;

  @ApiPropertyOptional({
    example: "Apartment 4B",
    description: "Address line 2",
  })
  @IsOptional()
  @IsString()
  address_line2?: string;

  @ApiPropertyOptional({
    example: "Karachi",
    description: "City",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    example: "Sindh",
    description: "State or province",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({
    example: "75500",
    description: "Pincode",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{5,10}$/, {
    message: "Pincode must be 5-10 digits",
  })
  pincode?: string;

  @ApiPropertyOptional({
    example: 24.8607,
    description: "Latitude",
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    example: 67.0011,
    description: "Longitude",
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    example: false,
    description: "Set as default address",
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class AddressResponseDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  id: string;

  @ApiProperty({ example: "clh1234567890abcdef" })
  userId: string;

  @ApiPropertyOptional({ example: "Home" })
  label?: string;

  @ApiProperty({ example: "123 Main Street" })
  addressLine1: string;

  @ApiPropertyOptional({ example: "Apartment 4B" })
  addressLine2?: string;

  @ApiProperty({ example: "Karachi" })
  city: string;

  @ApiProperty({ example: "Sindh" })
  state: string;

  @ApiProperty({ example: "75500" })
  pincode: string;

  @ApiPropertyOptional({ example: 24.8607 })
  latitude?: number;

  @ApiPropertyOptional({ example: 67.0011 })
  longitude?: number;

  @ApiProperty({ example: true })
  isDefault: boolean;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  updatedAt: Date;
}
