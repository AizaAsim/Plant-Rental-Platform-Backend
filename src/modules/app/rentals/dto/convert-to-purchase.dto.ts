import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsBoolean, IsOptional } from "class-validator";

export class ConvertToPurchaseDto {
  @ApiPropertyOptional({
    example: true,
    description: "Apply rental payments as credit toward purchase",
  })
  @IsOptional()
  @IsBoolean()
  applyRentalCredit?: boolean;

  @ApiPropertyOptional({
    example: "I love this plant and want to keep it",
    description: "Reason for conversion",
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
