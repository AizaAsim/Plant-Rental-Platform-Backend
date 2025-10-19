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
    example: "John",
    description: "User first name",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({
    example: "Doe",
    description: "User last name",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

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
  avatar?: string;

  @ApiPropertyOptional({
    example: "1990-01-01",
    description: "User date of birth",
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

export class ProfileResponseDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  id: string;

  @ApiProperty({ example: "john.doe@example.com" })
  email: string;

  @ApiProperty({ example: "John" })
  firstName: string;

  @ApiProperty({ example: "Doe" })
  lastName: string;

  @ApiProperty({ example: "+923001234567", required: false })
  phone?: string;

  @ApiProperty({ example: "https://example.com/avatar.jpg", required: false })
  avatar?: string;

  @ApiProperty({ example: "1990-01-01", required: false })
  dateOfBirth?: Date;

  @ApiProperty({ example: "USER", enum: ["USER", "ADMIN"] })
  role: string;

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
