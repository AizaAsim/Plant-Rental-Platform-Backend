// src/modules/app/plants/plants.controller.ts
import { Controller, Get, Query, Param, UseInterceptors } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { PlantsService } from "./plants.service";
import { PlantFilterDto } from "./dto/plant-filter.dto";
import { PlantSearchDto } from "./dto/plant-search.dto";
import {
  PlantResponseDto,
  PlantListResponseDto,
  CategoryResponseDto,
} from "./dto/plant-response.dto";
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";

@ApiTags("Plants")
@Controller("plants")
@UseInterceptors(CacheInterceptor) // Cache responses
export class PlantsController {
  constructor(private readonly plantsService: PlantsService) {}

  @Get()
  @CacheTTL(300) // Cache for 5 minutes
  @ApiOperation({ summary: "Browse all plants with filters" })
  @ApiResponse({
    status: 200,
    description: "Plants retrieved successfully",
    type: PlantListResponseDto,
  })
  async findAll(
    @Query() filterDto: PlantFilterDto
  ): Promise<PlantListResponseDto> {
    const result = await this.plantsService.findAll(filterDto);
    return {
      data: result.data.map((plant) => ({
        ...plant,
        images: Array.isArray(plant.images)
          ? plant.images.map((image) => String(image))
          : [String(plant.images)], // Ensure images is an array of strings
      })),
      hasPrevious: result.hasPrevious,
      total: result.total, // Add total
      page: result.page, // Add page
      limit: result.limit, // Add limit
      totalPages: result.totalPages, // Add totalPages
      hasNext: result.hasNext, // Add hasNext
    };
  }

  @Get("featured")
  @CacheTTL(600) // Cache for 10 minutes
  @ApiOperation({ summary: "Get featured plants" })
  @ApiResponse({
    status: 200,
    description: "Featured plants retrieved successfully",
    type: [PlantResponseDto],
  })
  async getFeaturedPlants(): Promise<PlantResponseDto[]> {
    const featuredPlants = await this.plantsService.getFeaturedPlants();
    return featuredPlants.map((plant) => ({
      ...plant,
      images: Array.isArray(plant.images)
        ? plant.images.map((image) => String(image))
        : [String(plant.images)],
    }));
  }

  @Get("popular")
  @CacheTTL(600) // Cache for 10 minutes
  @ApiOperation({ summary: "Get popular plants" })
  @ApiResponse({
    status: 200,
    description: "Popular plants retrieved successfully",
    type: [PlantResponseDto],
  })
  async getPopularPlants(): Promise<PlantResponseDto[]> {
    const popularPlants = await this.plantsService.getPopularPlants();
    return popularPlants.map((plant) => ({
      ...plant,
      images: Array.isArray(plant.images)
        ? plant.images.map((image) => String(image))
        : [String(plant.images)],
    }));
  }

  @Get("categories")
  @CacheTTL(3600) // Cache for 1 hour
  @ApiOperation({ summary: "Get all plant categories with counts" })
  @ApiResponse({
    status: 200,
    description: "Categories retrieved successfully",
    type: [CategoryResponseDto],
  })
  async getCategories(): Promise<CategoryResponseDto[]> {
    return this.plantsService.getCategories();
  }

  @Get("search")
  @ApiOperation({ summary: "Search plants" })
  @ApiResponse({
    status: 200,
    description: "Search results retrieved successfully",
    type: PlantListResponseDto,
  })
  async search(
    @Query() searchDto: PlantSearchDto
  ): Promise<PlantListResponseDto> {
    const result = await this.plantsService.search(searchDto);
    return {
      data: result.data.map((plant) => ({
        ...plant,
        images: Array.isArray(plant.images)
          ? plant.images.map((image) => String(image))
          : [String(plant.images)],
      })),
      hasPrevious: result.hasPrevious,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasNext: result.hasNext,
    };
  }

  @Get(":id")
  @CacheTTL(600) // Cache for 10 minutes
  @ApiOperation({ summary: "Get plant details by ID" })
  @ApiParam({ name: "id", description: "Plant ID" })
  @ApiResponse({
    status: 200,
    description: "Plant details retrieved successfully",
    type: PlantResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Plant not found",
  })
  async findById(@Param("id") id: string): Promise<PlantResponseDto> {
    const plant = await this.plantsService.findById(id);
    return {
      ...plant,
      images: Array.isArray(plant.images)
        ? plant.images.map(String)
        : [String(plant.images)],
    };
  }
}
