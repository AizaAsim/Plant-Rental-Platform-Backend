import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  ValidateNested,
  IsNumber,
  IsString,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  Matches,
} from "class-validator";
import { Type } from "class-transformer";

export class WorkingHourDto {
  @ApiProperty({
    example: 0,
    description: "Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)",
    minimum: 0,
    maximum: 6,
  })
  @IsNumber()
  @Min(0)
  @Max(6)
  day_of_week: number;

  @ApiPropertyOptional({
    example: "09:00",
    description: "Open time in HH:mm format",
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Open time must be in HH:mm format",
  })
  open_time?: string;

  @ApiPropertyOptional({
    example: "18:00",
    description: "Close time in HH:mm format",
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Close time must be in HH:mm format",
  })
  close_time?: string;

  @ApiPropertyOptional({
    example: false,
    description: "Whether the nursery is closed on this day",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_closed?: boolean;
}

export class UpdateWorkingHoursDto {
  @ApiProperty({
    type: [WorkingHourDto],
    description: "Array of working hours for each day",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHourDto)
  working_hours: WorkingHourDto[];
}
