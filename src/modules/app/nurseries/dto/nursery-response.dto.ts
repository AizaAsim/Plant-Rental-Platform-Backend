import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class NurseryResponseDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  id: string;

  @ApiProperty({ example: "Green Paradise Nursery" })
  name: string;

  @ApiProperty({ example: "nursery@example.com" })
  email: string;

  @ApiProperty({ example: "+923001234567" })
  phone: string;

  @ApiPropertyOptional({
    example: "We specialize in indoor plants and succulents",
  })
  description?: string;

  @ApiPropertyOptional({ example: "https://example.com/logo.jpg" })
  logo?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiPropertyOptional({ example: "BL-12345" })
  businessLicense?: string;

  @ApiProperty({ example: 4.5 })
  rating: number;

  @ApiProperty({ example: 150 })
  totalReviews: number;

  @ApiProperty({ example: "123 Garden Street" })
  address: string;

  @ApiProperty({ example: "Karachi" })
  city: string;

  @ApiProperty({ example: "Sindh" })
  state: string;

  @ApiProperty({ example: "75500" })
  zipCode: string;

  @ApiPropertyOptional({ example: 24.8607, description: "Latitude coordinate" })
  latitude?: number;

  @ApiPropertyOptional({
    example: 67.0011,
    description: "Longitude coordinate",
  })
  longitude?: number;

  @ApiPropertyOptional({
    example: ["75500", "75501", "75502"],
    description: "Service area zip codes",
    type: [String],
  })
  serviceAreas?: string[];

  @ApiProperty({ example: 50, description: "Delivery fee in PKR" })
  deliveryFee: number;

  @ApiProperty({ example: 500, description: "Minimum order amount in PKR" })
  minimumOrder: number;

  @ApiProperty({ example: 10, description: "Maximum delivery range in km" })
  maxDeliveryRange: number;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  updatedAt: Date;

  @ApiPropertyOptional({
    example: 5.2,
    description: "Distance from user in km",
  })
  distance?: number;

  @ApiPropertyOptional({ example: 250, description: "Total plants available" })
  totalPlants?: number;

  @ApiPropertyOptional({
    example: 180,
    description: "Available plants in stock",
  })
  availablePlants?: number;
}

export class NurseryListResponseDto {
  @ApiProperty({ type: [NurseryResponseDto] })
  data: NurseryResponseDto[];

  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNext: boolean;

  @ApiProperty({ example: false })
  hasPrevious: boolean;
}

export class NurseryDetailsResponseDto extends NurseryResponseDto {
  @ApiPropertyOptional({ description: "Recent plants from this nursery" })
  recentPlants?: any[];

  @ApiPropertyOptional({ description: "Top rated plants from this nursery" })
  topRatedPlants?: any[];

  @ApiPropertyOptional({ description: "Statistics about the nursery" })
  stats?: {
    totalPlants: number;
    totalOrders: number;
    totalCustomers: number;
    averageDeliveryTime: number;
    completionRate: number;
  };

  @ApiPropertyOptional({ description: "Working hours" })
  workingHours?: any;

  @ApiPropertyOptional({ description: "Recent reviews" })
  recentReviews?: any[];
}
