import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString, IsOptional } from "class-validator";

export class UpdateServiceAreasDto {
  @ApiProperty({
    example: ["75500", "75501", "75502"],
    description: "Array of pincodes",
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pincodes?: string[];

  @ApiProperty({
    example: ["Karachi", "Lahore"],
    description: "Array of cities",
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  cities?: string[];
}
