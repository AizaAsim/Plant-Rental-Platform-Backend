import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  Matches,
  IsNotEmpty,
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
    example: "John",
    description: "User first name",
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    example: "Doe",
    description: "User last name",
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

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
    example: "+923001234567",
    description: "User phone number (optional)",
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: "Please provide a valid phone number",
  })
  phone?: string;

  @ApiProperty({
    enum: UserRole,
    default: UserRole.USER,
    description: "User role",
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
