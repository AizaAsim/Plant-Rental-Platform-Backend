// src/modules/app/rentals/rentals.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { RentalsService } from "./rentals.service";
import { CreateRentalDto } from "./dto/create-rental.dto";
import { UpdateRentalDto } from "./dto/update-rental.dto";
import { ExtendRentalDto } from "./dto/extend-rental.dto";
import { ConvertToPurchaseDto } from "./dto/convert-to-purchase.dto";
import { CheckAvailabilityDto } from "./dto/check-availability.dto";
import { RentalFilterDto } from "./dto/rental-filter.dto";
import {
  RentalResponseDto,
  RentalListResponseDto,
  AvailabilityResponseDto,
} from "./dto/rental-response.dto";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";

@ApiTags("Rentals")
@Controller("rentals")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new rental" })
  @ApiResponse({
    status: 201,
    description: "Rental created successfully",
    type: RentalResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Plant or address not found" })
  async create(
    @Request() req,
    @Body() createRentalDto: CreateRentalDto
  ): Promise<RentalResponseDto> {
    // This will throw an error directing users to use Orders API
    return this.rentalsService.create(req.user.id, createRentalDto) as any;
  }

  @Get()
  @ApiOperation({ summary: "List user rentals" })
  @ApiResponse({
    status: 200,
    description: "Rentals retrieved successfully",
    type: RentalListResponseDto,
  })
  async findAll(
    @Request() req,
    @Query() filterDto: RentalFilterDto
  ): Promise<RentalListResponseDto> {
    return this.rentalsService.findAll(req.user.id, filterDto);
  }

  @Post("availability")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Check plant availability for dates" })
  @ApiResponse({
    status: 200,
    description: "Availability checked successfully",
    type: AvailabilityResponseDto,
  })
  async checkAvailability(
    @Body() checkAvailabilityDto: CheckAvailabilityDto
  ): Promise<AvailabilityResponseDto> {
    return this.rentalsService.checkAvailability(checkAvailabilityDto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get rental details" })
  @ApiParam({ name: "id", description: "Rental ID" })
  @ApiResponse({
    status: 200,
    description: "Rental details retrieved successfully",
    type: RentalResponseDto,
  })
  @ApiResponse({ status: 404, description: "Rental not found" })
  async findById(
    @Request() req,
    @Param("id") id: string
  ): Promise<RentalResponseDto> {
    return this.rentalsService.findById(id, req.user.id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update rental" })
  @ApiParam({ name: "id", description: "Rental ID" })
  @ApiResponse({
    status: 200,
    description: "Rental updated successfully",
    type: RentalResponseDto,
  })
  @ApiResponse({ status: 404, description: "Rental not found" })
  async update(
    @Request() req,
    @Param("id") id: string,
    @Body() updateRentalDto: UpdateRentalDto
  ): Promise<RentalResponseDto> {
    return this.rentalsService.update(id, req.user.id, updateRentalDto);
  }

  @Post(":id/extend")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Extend rental period" })
  @ApiParam({ name: "id", description: "Rental ID" })
  @ApiResponse({
    status: 200,
    description: "Rental extended successfully",
    type: RentalResponseDto,
  })
  @ApiResponse({ status: 400, description: "Extension not allowed" })
  @ApiResponse({ status: 404, description: "Rental not found" })
  async extendRental(
    @Request() req,
    @Param("id") id: string,
    @Body() extendRentalDto: ExtendRentalDto
  ): Promise<RentalResponseDto> {
    return this.rentalsService.extendRental(id, req.user.id, extendRentalDto);
  }

  @Post(":id/convert-to-purchase")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Convert rental to purchase" })
  @ApiParam({ name: "id", description: "Rental ID" })
  @ApiResponse({
    status: 200,
    description: "Rental converted to purchase successfully",
  })
  @ApiResponse({ status: 400, description: "Conversion not allowed" })
  @ApiResponse({ status: 404, description: "Rental not found" })
  async convertToPurchase(
    @Request() req,
    @Param("id") id: string,
    @Body() convertToPurchaseDto: ConvertToPurchaseDto
  ) {
    return this.rentalsService.convertToPurchase(
      id,
      req.user.id,
      convertToPurchaseDto
    );
  }
}
