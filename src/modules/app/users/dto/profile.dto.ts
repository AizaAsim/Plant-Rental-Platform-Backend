import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsDateString,
  IsUrl,
  MinLength,
  MaxLength,
} from "class-validator";

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: "John Doe",
    description: "User full name",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  full_name?: string;

  @ApiPropertyOptional({
    example: "+923001234567",
    description: "User phone number",
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: "https://example.com/avatar.jpg",
    description: "User avatar URL",
  })
  @IsOptional()
  @IsUrl()
  avatar_url?: string;

  @ApiPropertyOptional({
    example: "Acme Corp",
    description: "Company name (for corporate users)",
  })
  @IsOptional()
  @IsString()
  company_name?: string;

  @ApiPropertyOptional({
    example: "GST123456789",
    description: "GST number",
  })
  @IsOptional()
  @IsString()
  gst_number?: string;
}

export class ProfileResponseDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  id: string;

  @ApiProperty({ example: "john.doe@example.com" })
  email: string;

  @ApiProperty({ example: "John Doe" })
  fullName: string;

  @ApiProperty({ example: "+923001234567", required: false })
  phone?: string;

  @ApiProperty({ example: "https://example.com/avatar.jpg", required: false })
  avatarUrl?: string;

  @ApiProperty({ example: "USER", enum: ["USER", "VENDOR", "GARDENER", "ADMIN"] })
  role: string;

  @ApiProperty({ example: false })
  isCorporate: boolean;

  @ApiProperty({ example: "Acme Corp", required: false })
  companyName?: string;

  @ApiProperty({ example: "GST123456789", required: false })
  gstNumber?: string;

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  updatedAt: Date;

  @ApiProperty({
    description: "User addresses",
    type: "array",
    required: false,
  })
  addresses?: any[];
}
