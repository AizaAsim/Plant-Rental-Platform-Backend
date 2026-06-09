import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class NurseryImagePublicDto {
  @ApiProperty({ example: "image-uuid" })
  id: string;

  @ApiProperty({ example: "https://cdn.example.com/nurseries/gallery-1.jpg" })
  imageUrl: string;

  @ApiProperty({ example: 0 })
  displayOrder: number;
}

/** Consistent customer-facing nursery shape for list and detail. */
export class NurseryPublicDto {
  @ApiProperty({ example: "nursery-uuid" })
  id: string;

  @ApiProperty({ example: "Green Paradise Nursery" })
  name: string;

  @ApiPropertyOptional({ example: "green-paradise-nursery" })
  slug?: string;

  @ApiPropertyOptional({ example: "Indoor and outdoor plant nursery." })
  description?: string | null;

  @ApiPropertyOptional({ example: "/uploads/nurseries/logos/logo.jpg" })
  logoUrl?: string | null;

  @ApiPropertyOptional({ example: "/uploads/nurseries/covers/cover.jpg" })
  coverImageUrl?: string | null;

  @ApiProperty({ example: "4.8" })
  ratingAvg: string;

  @ApiProperty({ example: 128 })
  totalReviews: number;

  @ApiProperty({ type: [NurseryImagePublicDto] })
  images: NurseryImagePublicDto[];

  @ApiPropertyOptional({ example: "Karachi" })
  city?: string;

  @ApiPropertyOptional({ example: true })
  isVerified?: boolean;

  @ApiPropertyOptional({ example: 2.4, description: "km — present when latitude/longitude query used" })
  distance?: number;
}

export class NurseryListResponseDto {
  @ApiProperty({ type: [NurseryPublicDto] })
  items: NurseryPublicDto[];

  @ApiProperty({
    example: { page: 1, limit: 5, total: 12, totalPages: 3 },
  })
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
