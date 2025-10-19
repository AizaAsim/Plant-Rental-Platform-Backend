import { ApiPropertyOptional } from "@nestjs/swagger";
import { PlantFilterDto } from "./plant-filter.dto";
import { IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";

export class PlantSearchDto extends PlantFilterDto {
  @ApiPropertyOptional({
    description: "Search query",
    minLength: 2,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  q?: string;
}
