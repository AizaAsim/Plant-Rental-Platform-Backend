import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MediaUploadResponseDto {
  @ApiProperty({
    example: "/uploads/nurseries/covers/1710000000000-uuid.jpg",
    description: "Public URL (absolute when APP_PUBLIC_BASE_URL set, else path-style)",
  })
  url: string;

  @ApiProperty({
    example: "/uploads/nurseries/covers/1710000000000-uuid.jpg",
    description: "Stable app-relative path for storing on nursery profile",
  })
  path: string;

  @ApiProperty({ example: "nurseries/covers/1710000000000-uuid.jpg" })
  key: string;

  @ApiProperty({ example: 245760 })
  size: number;

  @ApiProperty({ example: "image/jpeg" })
  mime_type: string;

  @ApiProperty({ enum: ["local", "s3"] })
  storage: string;

  @ApiPropertyOptional({ example: "512x512", description: "Resize hint accepted; applied when supported" })
  resize_requested?: string;
}
