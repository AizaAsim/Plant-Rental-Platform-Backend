import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

const toLower = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

/** Body for PUT /api/v1/preferences/recommendation (save modal) */
export class UpsertRecommendationPreferenceDto {
  @ApiProperty({ example: "Karachi" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: "medium", enum: ["low", "medium", "high"] })
  @Transform(({ value }) => toLower(value))
  @IsString()
  @IsIn(["low", "medium", "high"])
  light_pref: string;

  @ApiPropertyOptional({ example: "low", enum: ["low", "medium", "high"] })
  @Transform(({ value }) => (value === undefined || value === null ? value : toLower(value)))
  @IsOptional()
  @IsString()
  @IsIn(["low", "medium", "high"])
  water_pref?: string;

  @ApiProperty({ example: true })
  @Transform(({ value }) => {
    if (value === true || value === "true" || value === 1 || value === "1") return true;
    if (value === false || value === "false" || value === 0 || value === "0") return false;
    return value;
  })
  @IsBoolean()
  pet_friendly: boolean;

  @ApiProperty({ example: "small", enum: ["small", "medium", "large"] })
  @Transform(({ value }) => toLower(value))
  @IsString()
  @IsIn(["small", "medium", "large"])
  space: string;

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  top_n?: number;
}
