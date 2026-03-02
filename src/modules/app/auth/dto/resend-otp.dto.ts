import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsEnum } from "class-validator";
import { OtpPurpose } from "@prisma/client";

export class ResendOtpDto {
  @ApiProperty({
    example: "user@example.com",
    description: "Email or phone number",
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({
    enum: OtpPurpose,
    example: OtpPurpose.SIGNUP,
    description: "Purpose of OTP",
  })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
