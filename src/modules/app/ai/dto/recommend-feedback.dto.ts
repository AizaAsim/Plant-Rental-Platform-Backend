import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

/** Body for POST /feedback/{log_id} on the recommender (proxied). */
export class RecommendFeedbackDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (value === true || value === "true" || value === 1 || value === "1") return true;
    if (value === false || value === "false" || value === 0 || value === "0") return false;
    return value;
  })
  @IsBoolean()
  helpful?: boolean;

  @ApiPropertyOptional({ example: "Picked Snake Plant" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
