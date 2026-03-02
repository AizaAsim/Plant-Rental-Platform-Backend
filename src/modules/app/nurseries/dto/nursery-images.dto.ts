import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  ValidateNested,
  IsString,
  IsNumber,
  IsUrl,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class NurseryImageDto {
  @ApiProperty({
    example: "https://example.com/image.jpg",
    description: "Image URL",
  })
  @IsString()
  @IsUrl()
  image_url: string;

  @ApiProperty({
    example: 0,
    description: "Display order",
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  display_order: number;
}

export class AddNurseryImagesDto {
  @ApiProperty({
    type: [NurseryImageDto],
    description: "Array of images",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NurseryImageDto)
  images: NurseryImageDto[];
}
