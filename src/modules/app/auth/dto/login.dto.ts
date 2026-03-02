import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsString, IsNotEmpty, IsOptional } from "class-validator";

export class LoginDto {
  @ApiProperty({
    example: "john.doe@example.com",
    description: "User email address",
  })
  @IsEmail({}, { message: "Please provide a valid email" })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: "SecurePass123!",
    description: "User password",
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({
    example: "iPhone 14 Pro",
    description: "Device information",
  })
  @IsOptional()
  @IsString()
  device_info?: string;
}
