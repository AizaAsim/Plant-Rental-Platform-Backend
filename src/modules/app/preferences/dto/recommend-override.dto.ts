import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

const toLower = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

/**
 * Optional overrides for POST .../ai/recommender/recommend.
 * Saved preferences (PUT /api/v1/preferences/recommendation) are used by default.
 */
export class RecommendOverrideDto {
  @ApiPropertyOptional({ example: "Karachi" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: "medium", enum: ["low", "medium", "high"] })
  @Transform(({ value }) => (value === undefined || value === null ? value : toLower(value)))
  @IsOptional()
  @IsString()
  @IsIn(["low", "medium", "high"])
  light_pref?: string;

  @ApiPropertyOptional({ example: "low", enum: ["low", "medium", "high"] })
  @Transform(({ value }) => (value === undefined || value === null ? value : toLower(value)))
  @IsOptional()
  @IsString()
  @IsIn(["low", "medium", "high"])
  water_pref?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (value === true || value === "true" || value === 1 || value === "1") return true;
    if (value === false || value === "false" || value === 0 || value === "0") return false;
    return value;
  })
  @IsBoolean()
  pet_friendly?: boolean;

  @ApiPropertyOptional({ example: "small", enum: ["small", "medium", "large"] })
  @Transform(({ value }) => (value === undefined || value === null ? value : toLower(value)))
  @IsOptional()
  @IsString()
  @IsIn(["small", "medium", "large"])
  space?: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  top_n?: number;
}
