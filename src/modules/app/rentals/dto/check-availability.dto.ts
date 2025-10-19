import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
} from "class-validator";

export class CheckAvailabilityDto {
  @ApiProperty({
    example: "clh1234567890abcdef",
    description: "Plant ID",
  })
  @IsString()
  plantId: string;

  @ApiProperty({
    example: "2024-01-15",
    description: "Start date",
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    example: "2024-02-12",
    description: "End date",
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    example: 1,
    description: "Quantity needed",
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;
}
