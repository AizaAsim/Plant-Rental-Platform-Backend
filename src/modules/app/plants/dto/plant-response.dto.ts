import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class NurseryInfoDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  id: string;

  @ApiProperty({ example: "Green Paradise Nursery" })
  name: string;

  @ApiProperty({ example: "Karachi" })
  city: string;

  @ApiProperty({ example: 4.5 })
  rating: number;

  @ApiPropertyOptional({ example: "https://example.com/logo.jpg" })
  logo?: string;
}

export class PlantResponseDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  id: string;

  @ApiProperty({ example: "clh1234567890abcdef" })
  nurseryId: string;

  @ApiProperty({ example: "Monstera Deliciosa" })
  name: string;

  @ApiPropertyOptional({
    example: "A beautiful indoor plant with split leaves",
  })
  description?: string;

  @ApiProperty({
    example: "INDOOR",
    enum: [
      "INDOOR",
      "OUTDOOR",
      "SUCCULENTS",
      "FLOWERING",
      "FOLIAGE",
      "HERBS",
      "TREES",
      "SHRUBS",
    ],
  })
  category: string;

  @ApiPropertyOptional({ example: "Monstera deliciosa" })
  scientificName?: string;

  @ApiProperty({
    example: "LARGE",
    enum: ["SMALL", "MEDIUM", "LARGE", "EXTRA_LARGE"],
  })
  size: string;

  @ApiProperty({ example: "EASY", enum: ["EASY", "MODERATE", "DIFFICULT"] })
  careLevel: string;

  @ApiProperty({
    example: "BRIGHT_INDIRECT",
    enum: ["LOW", "MEDIUM", "HIGH", "BRIGHT_INDIRECT"],
  })
  lightRequirement: string;

  @ApiProperty({ example: 7, description: "Days between watering" })
  wateringFrequency: number;

  @ApiProperty({ example: false })
  isPetSafe: boolean;

  @ApiProperty({ example: true })
  isIndoor: boolean;

  @ApiProperty({ example: 2500 })
  purchasePrice: number;

  @ApiProperty({ example: 500, description: "Rental price per week" })
  rentalPrice: number;

  @ApiProperty({ example: 1000 })
  securityDeposit: number;

  @ApiProperty({ example: 10 })
  totalStock: number;

  @ApiProperty({ example: 8 })
  availableStock: number;

  @ApiProperty({
    example: [
      "https://example.com/plant1.jpg",
      "https://example.com/plant2.jpg",
    ],
    type: [String],
  })
  images: string[];

  @ApiPropertyOptional({
    example: "Water when top soil is dry. Provide bright indirect light.",
  })
  careInstructions?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  isFeatured: boolean;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  updatedAt: Date;

  @ApiPropertyOptional({ description: "Nursery information" })
  nursery?: NurseryInfoDto;

  @ApiPropertyOptional({ example: 4.5, description: "Average rating" })
  averageRating?: number;

  @ApiPropertyOptional({ example: 10, description: "Total reviews" })
  totalReviews?: number;
}

export class PlantListResponseDto {
  @ApiProperty({ type: [PlantResponseDto] })
  data: PlantResponseDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNext: boolean;

  @ApiProperty({ example: false })
  hasPrevious: boolean;
}

export class CategoryResponseDto {
  @ApiProperty({ example: "INDOOR" })
  value: string;

  @ApiProperty({ example: "Indoor Plants" })
  label: string;

  @ApiProperty({
    example: 25,
    description: "Number of plants in this category",
  })
  count: number;

  @ApiPropertyOptional({ example: "🌿", description: "Category icon/emoji" })
  icon?: string;
}
