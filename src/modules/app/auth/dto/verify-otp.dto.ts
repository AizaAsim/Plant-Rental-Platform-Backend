import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsEnum, Matches } from "class-validator";
import { OtpPurpose } from "@prisma/client";

export class VerifyOtpDto {
  @ApiProperty({
    example: "user@example.com",
    description: "Email or phone number",
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

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
    enum: OtpPurpose,
    example: OtpPurpose.SIGNUP,
    description: "Purpose of OTP verification",
  })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
