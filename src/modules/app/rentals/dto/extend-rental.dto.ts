import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNumber, IsEnum, IsOptional, Min } from "class-validator";
export class ExtendRentalDto {
  @ApiProperty({
    example: 2,
    description: "Additional weeks to extend",
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  additionalWeeks: number;

  @ApiPropertyOptional({
    example: "I would like to keep the plant longer",
    description: "Reason for extension",
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
