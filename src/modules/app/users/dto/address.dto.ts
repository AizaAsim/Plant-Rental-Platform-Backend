import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from "class-validator";
import { AddressType } from "@prisma/client";

export class CreateAddressDto {
  @ApiProperty({
    enum: AddressType,
    example: "HOME",
    description: "Type of address",
  })
  @IsEnum(AddressType)
  type: AddressType;

  @ApiProperty({
    example: "123 Main Street",
    description: "Street address",
  })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  street: string;

  @ApiProperty({
    example: "Karachi",
    description: "City",
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city: string;

  @ApiProperty({
    example: "Sindh",
    description: "State or province",
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  state: string;

  @ApiProperty({
    example: "75500",
    description: "Postal/ZIP code",
  })
  @IsString()
  @Matches(/^[0-9]{5,10}$/, {
    message: "Zip code must be 5-10 digits",
  })
  zipCode: string;

  @ApiPropertyOptional({
    example: "Pakistan",
    default: "Pakistan",
    description: "Country",
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    example: false,
    description: "Set as default address",
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @ApiPropertyOptional({
    enum: AddressType,
    example: "HOME",
    description: "Type of address",
  })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;

  @ApiPropertyOptional({
    example: "123 Main Street",
    description: "Street address",
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  street?: string;

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
    description: "Postal/ZIP code",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{5,10}$/, {
    message: "Zip code must be 5-10 digits",
  })
  zipCode?: string;

  @ApiPropertyOptional({
    example: "Pakistan",
    description: "Country",
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    example: false,
    description: "Set as default address",
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class AddressResponseDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  id: string;

  @ApiProperty({ example: "clh1234567890abcdef" })
  userId: string;

  @ApiProperty({ enum: AddressType, example: "HOME" })
  type: AddressType;

  @ApiProperty({ example: "123 Main Street" })
  street: string;

  @ApiProperty({ example: "Karachi" })
  city: string;

  @ApiProperty({ example: "Sindh" })
  state: string;

  @ApiProperty({ example: "75500" })
  zipCode: string;

  @ApiProperty({ example: "Pakistan" })
  country: string;

  @ApiProperty({ example: true })
  isDefault: boolean;
}
