import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEmail,
  Min,
  Max,
} from "class-validator";

export class CreateNurseryDto {
  @ApiProperty({
    example: "Green Thumb Nursery",
    description: "Nursery name",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: "A beautiful nursery with a wide variety of plants",
    description: "Nursery description",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: "https://example.com/logo.jpg",
    description: "Logo URL",
  })
  @IsOptional()
  @IsString()
  logo_url?: string;

  @ApiPropertyOptional({
    example: "https://example.com/cover.jpg",
    description: "Cover image URL",
  })
  @IsOptional()
  @IsString()
  cover_image_url?: string;

  @ApiProperty({
    example: "123 Main Street",
    description: "Address line 1",
  })
  @IsString()
  @IsNotEmpty()
  address_line1: string;

  @ApiPropertyOptional({
    example: "Building A",
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
  city: string;

  @ApiProperty({
    example: "Sindh",
    description: "State",
  })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({
    example: "75500",
    description: "Pincode",
  })
  @IsString()
  @IsNotEmpty()
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
    example: 10,
    description: "Service radius in km",
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  service_radius_km?: number;

  @ApiProperty({
    example: "+923001234567",
    description: "Phone number",
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({
    example: "contact@nursery.com",
    description: "Email address",
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
