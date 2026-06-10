import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, IsString, IsUUID, Min, ValidateNested } from "class-validator";

export class GalleryOrderItemDto {
  @ApiProperty({ example: "image-uuid" })
  @IsString()
  @IsUUID()
  image_id: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  display_order: number;
}

export class ReorderNurseryGalleryDto {
  @ApiProperty({ type: [GalleryOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GalleryOrderItemDto)
  images: GalleryOrderItemDto[];
}

export class NurseryMediaResponseDto {
  @ApiProperty({ example: "https://cdn.example.com/nurseries/nursery-uuid/cover/cover.jpg" })
  coverImageUrl: string;

  @ApiProperty({ example: "https://cdn.example.com/nurseries/nursery-uuid/profile/profile.jpg" })
  profilePictureUrl: string;

  @ApiProperty({ example: "https://cdn.example.com/nurseries/nursery-uuid/logo/logo.jpg", nullable: true })
  logoUrl: string | null;

  @ApiProperty({
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        imageUrl: { type: "string" },
        displayOrder: { type: "number" },
      },
    },
  })
  images: { id: string; imageUrl: string; displayOrder: number }[];
}
