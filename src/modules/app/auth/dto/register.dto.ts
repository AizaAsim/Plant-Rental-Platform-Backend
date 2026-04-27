import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  Matches,
  IsNotEmpty,
  IsBoolean,
  ValidateIf,
} from "class-validator";
import { UserRole } from "@prisma/client";

export class RegisterDto {
  @ApiProperty({
    example: "john.doe@example.com",
    description: "User email address",
  })
  @IsEmail({}, { message: "Please provide a valid email" })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: "SecurePass123!",
    description:
      "User password (min 8 characters, must contain uppercase, lowercase, number and special character)",
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      "Password must contain uppercase, lowercase, number and special character",
  })
  password: string;

  @ApiProperty({
    example: "John Doe",
    description: "User full name",
  })
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @ApiProperty({
    example: "+923001234567",
    description: "User phone number",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: "Please provide a valid phone number",
  })
  phone: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.USER,
    description: "User role",
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({
    example: false,
    description: "Is corporate user (for USER role)",
  })
  @IsOptional()
  @IsBoolean()
  is_corporate?: boolean;

  @ApiPropertyOptional({
    example: "Acme Corp",
    description: "Company name (required if is_corporate is true)",
  })
  @ValidateIf((o) => o.is_corporate === true)
  @IsString()
  @IsNotEmpty()
  company_name?: string;

  @ApiPropertyOptional({
    example: "GST123456789",
    description: "GST number",
  })
  @IsOptional()
  @IsString()
  gst_number?: string;

  @ApiPropertyOptional({
    example: "STAFF",
    description: "MOD-01: when role is GARDENER, optional staff vs freelance hint (stored in register_meta)",
  })
  @IsOptional()
  @IsString()
  gardener_type?: string;
}
