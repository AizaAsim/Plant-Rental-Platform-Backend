import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength, Matches, IsNotEmpty } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({
    example: "CurrentPass123!",
    description: "Current password",
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

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
  newPassword: string;
}
