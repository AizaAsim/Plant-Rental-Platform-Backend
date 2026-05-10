// src/modules/app/rentals/rentals.controller.ts
import {
  BadRequestException,
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
  ApiBody,
} from "@nestjs/swagger";
import { RentalsService } from "./rentals.service";
import { CartService } from "../cart/cart.service";
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
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

/** Canonical `api/v1/rentals` plus legacy `/rentals` prefix (same handlers). */
@ApiTags("Rentals")
@Controller(["api/v1/rentals", "rentals"])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER)
@ApiBearerAuth()
export class RentalsController {
  constructor(
    private readonly rentalsService: RentalsService,
    private readonly cartService: CartService
  ) {}

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
  async create(@Request() req, @Body() createRentalDto: CreateRentalDto): Promise<RentalResponseDto> {
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

  /**
   * Spec `POST …/rentals/draft`: persists rental intent via cart (same as `POST /api/v1/cart/items` with `order_type` RENT).
   */
  @Post("draft")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Save rental draft to cart — spec path; persisted like POST /api/v1/cart/items (RENT + rent dates)",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["plant_id", "rent_start_date", "rent_end_date"],
      properties: {
        plant_id: { type: "string", format: "uuid" },
        plantId: { type: "string", description: "Alias of plant_id" },
        quantity: { type: "number", default: 1 },
        rent_start_date: { type: "string", format: "date" },
        rentStartDate: { type: "string", description: "Alias of rent_start_date" },
        rent_end_date: { type: "string", format: "date" },
        rentEndDate: { type: "string", description: "Alias of rent_end_date" },
      },
    },
  })
  async createRentalDraft(@Request() req, @Body() body: Record<string, unknown>) {
    const pid = body.plant_id ?? body.plantId;
    if (pid == null || String(pid).trim() === "") {
      throw new BadRequestException("plant_id is required");
    }
    const qtyRaw = body.quantity ?? 1;
    const qty = Math.max(1, Number(qtyRaw) || 1);
    const rs = body.rent_start_date ?? body.rentStartDate;
    const re = body.rent_end_date ?? body.rentEndDate;
    if (!rs || !re) {
      throw new BadRequestException("rent_start_date and rent_end_date are required for rental draft");
    }
    return this.cartService.addItem(req.user.id, {
      plant_id: String(pid).trim(),
      quantity: qty,
      order_type: "RENT",
      rent_start_date: rs,
      rent_end_date: re,
    });
  }

  /**
   * Read current rental lines from cart (draft layer); canonical full cart remains `GET /api/v1/cart`.
   */
  @Get("draft")
  @ApiOperation({
    summary: "List rental-only lines from cart (draft view); canonical cart is GET /api/v1/cart",
  })
  async getRentalDraft(@Request() req) {
    const cart = await this.cartService.getCart(req.user.id);
    const items = (cart.items ?? []).filter(
      (i: { order_type?: string }) => String(i.order_type ?? "").toUpperCase() === "RENT"
    );
    return {
      draft_source: "cart",
      items,
      summary: cart.summary ?? null,
    };
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
  async findById(@Request() req, @Param("id") id: string): Promise<RentalResponseDto> {
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
    return this.rentalsService.convertToPurchase(id, req.user.id, convertToPurchaseDto);
  }
}
