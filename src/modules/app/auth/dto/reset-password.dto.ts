import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength, Matches, IsNotEmpty, IsEmail } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({
    example: "user@example.com",
    description: "User email address",
  })
  @IsEmail({}, { message: "Please provide a valid email" })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: "123456",
    description: "6-digit OTP code",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, {
    message: "OTP must be 6 digits",
  })
  otp: string;

  @ApiProperty({
    example: "NewSecurePass123!",
    description:
      "New password (min 8 characters, must contain uppercase, lowercase, number and special character)",
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      "Password must contain uppercase, lowercase, number and special character",
  })
  new_password: string;
}
