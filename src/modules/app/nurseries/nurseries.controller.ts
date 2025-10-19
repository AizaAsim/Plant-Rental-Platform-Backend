// src/modules/app/nurseries/nurseries.controller.ts
import {
  Controller,
  Get,
  Put,
  Query,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { NurseriesService } from "./nurseries.service";
import { NurseryFilterDto } from "./dto/nursery-filter.dto";
import {
  NurseryResponseDto,
  NurseryListResponseDto,
  NurseryDetailsResponseDto,
} from "./dto/nursery-response.dto";
import {
  InventoryItemDto,
  UpdateInventoryDto,
  BulkUpdateInventoryDto,
} from "./dto/inventory.dto";
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { NurseryAvailabilityResponseDto } from "./dto/availability.dto";
import { OptionalAuthGuard } from "../auth/guard/optional-auth.guard";

@ApiTags("Nurseries")
@Controller("nurseries")
@UseInterceptors(CacheInterceptor)
export class NurseriesController {
  constructor(private readonly nurseriesService: NurseriesService) {}

  @Get()
  @CacheTTL(300) // Cache for 5 minutes
  @ApiOperation({ summary: "List all nurseries with filters" })
  @ApiResponse({
    status: 200,
    description: "Nurseries retrieved successfully",
    type: NurseryListResponseDto,
  })
  async findAll(
    @Query() filterDto: NurseryFilterDto
  ): Promise<NurseryListResponseDto> {
    return this.nurseriesService.findAll(filterDto);
  }

  @Get(":id")
  @CacheTTL(600) // Cache for 10 minutes
  @ApiOperation({ summary: "Get nursery details by ID" })
  @ApiParam({ name: "id", description: "Nursery ID" })
  @ApiResponse({
    status: 200,
    description: "Nursery details retrieved successfully",
    type: NurseryDetailsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Nursery not found",
  })
  async findById(@Param("id") id: string): Promise<NurseryDetailsResponseDto> {
    return this.nurseriesService.findById(id);
  }

  @Get(":id/plants")
  @CacheTTL(300) // Cache for 5 minutes
  @ApiOperation({ summary: "Get plants from specific nursery" })
  @ApiParam({ name: "id", description: "Nursery ID" })
  @ApiResponse({
    status: 200,
    description: "Plants retrieved successfully",
  })
  async getPlantsByNursery(
    @Param("id") nurseryId: string,
    @Query() filterDto: any
  ) {
    return this.nurseriesService.getPlantsByNurseryId(nurseryId, filterDto);
  }

  @Get(":id/inventory")
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: "Get nursery inventory" })
  @ApiParam({ name: "id", description: "Nursery ID" })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: "Inventory retrieved successfully",
  })
  async getInventory(@Param("id") nurseryId: string, @Request() req) {
    return this.nurseriesService.getInventory(nurseryId, req.user?.id);
  }

  @Put(":id/inventory")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Update nursery inventory" })
  @ApiParam({ name: "id", description: "Nursery ID" })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: "Inventory updated successfully",
  })
  async updateInventory(
    @Param("id") nurseryId: string,
    @Body() updateDto: UpdateInventoryDto | BulkUpdateInventoryDto,
    @Request() req
  ) {
    return this.nurseriesService.updateInventory(
      nurseryId,
      updateDto,
      req.user.id
    );
  }

  @Get(":id/availability")
  @ApiOperation({ summary: "Get real-time plant availability" })
  @ApiParam({ name: "id", description: "Nursery ID" })
  @ApiResponse({
    status: 200,
    description: "Availability retrieved successfully",
    type: NurseryAvailabilityResponseDto,
  })
  async getAvailability(
    @Param("id") nurseryId: string,
    @Query("date") date?: string
  ): Promise<NurseryAvailabilityResponseDto> {
    return this.nurseriesService.getAvailability(nurseryId, date);
  }
}
