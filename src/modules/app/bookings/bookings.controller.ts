// src/modules/app/bookings/bookings.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
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
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { BookingsService } from "./bookings.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Bookings")
@Controller("api/v1/bookings")
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create service booking" })
  @ApiResponse({
    status: 201,
    description: "Booking created successfully",
  })
  async createBooking(@Request() req, @Body() createDto: any) {
    return this.bookingsService.createBooking(req.user.id, createDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user's bookings" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "date_from", required: false, type: String })
  @ApiQuery({ name: "date_to", required: false, type: String })
  @ApiResponse({
    status: 200,
    description: "Bookings retrieved successfully",
  })
  async getUserBookings(@Request() req, @Query() filterDto: any) {
    return this.bookingsService.getUserBookings(req.user.id, filterDto);
  }

  @Get(":booking_id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get booking details" })
  @ApiParam({ name: "booking_id", description: "Booking ID" })
  @ApiResponse({
    status: 200,
    description: "Booking details retrieved successfully",
  })
  async getBookingById(@Request() req, @Param("booking_id") bookingId: string) {
    return this.bookingsService.getBookingById(req.user.id, bookingId, req.user.role);
  }

  @Post(":booking_id/cancel")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancel booking" })
  @ApiParam({ name: "booking_id", description: "Booking ID" })
  @ApiResponse({
    status: 200,
    description: "Booking cancelled successfully",
  })
  async cancelBooking(
    @Request() req,
    @Param("booking_id") bookingId: string,
    @Body() cancelDto: any
  ) {
    return this.bookingsService.cancelBooking(req.user.id, bookingId, cancelDto);
  }

  @Post(":booking_id/reschedule")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reschedule booking" })
  @ApiParam({ name: "booking_id", description: "Booking ID" })
  @ApiResponse({
    status: 200,
    description: "Booking rescheduled successfully",
  })
  async rescheduleBooking(
    @Request() req,
    @Param("booking_id") bookingId: string,
    @Body() rescheduleDto: any
  ) {
    return this.bookingsService.rescheduleBooking(req.user.id, bookingId, rescheduleDto);
  }

  @Post(":booking_id/review")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Review completed booking" })
  @ApiParam({ name: "booking_id", description: "Booking ID" })
  @ApiResponse({
    status: 201,
    description: "Review created successfully",
  })
  async reviewBooking(
    @Request() req,
    @Param("booking_id") bookingId: string,
    @Body() reviewDto: any
  ) {
    return this.bookingsService.reviewBooking(req.user.id, bookingId, reviewDto);
  }

  // ========== GARDENER BOOKING MANAGEMENT ==========

  @Get("gardener/bookings")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get gardener's bookings" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "date_from", required: false, type: String })
  @ApiQuery({ name: "date_to", required: false, type: String })
  @ApiResponse({
    status: 200,
    description: "Bookings retrieved successfully",
  })
  async getGardenerBookings(@Request() req, @Query() filterDto: any) {
    return this.bookingsService.getGardenerBookings(req.user.id, filterDto);
  }

  @Get("gardener/bookings/:booking_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get booking details (gardener view)" })
  @ApiParam({ name: "booking_id", description: "Booking ID" })
  @ApiResponse({
    status: 200,
    description: "Booking details retrieved successfully",
  })
  async getGardenerBooking(@Request() req, @Param("booking_id") bookingId: string) {
    return this.bookingsService.getGardenerBooking(req.user.id, bookingId);
  }

  @Post("gardener/bookings/:booking_id/accept")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Accept booking request" })
  @ApiParam({ name: "booking_id", description: "Booking ID" })
  @ApiResponse({
    status: 200,
    description: "Booking accepted successfully",
  })
  async acceptBooking(@Request() req, @Param("booking_id") bookingId: string) {
    return this.bookingsService.acceptBooking(req.user.id, bookingId);
  }

  @Post("gardener/bookings/:booking_id/reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reject booking request" })
  @ApiParam({ name: "booking_id", description: "Booking ID" })
  @ApiResponse({
    status: 200,
    description: "Booking rejected successfully",
  })
  async rejectBooking(
    @Request() req,
    @Param("booking_id") bookingId: string,
    @Body() rejectDto: any
  ) {
    return this.bookingsService.rejectBooking(req.user.id, bookingId, rejectDto);
  }

  @Post("gardener/bookings/:booking_id/start")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Start service" })
  @ApiParam({ name: "booking_id", description: "Booking ID" })
  @ApiResponse({
    status: 200,
    description: "Service started successfully",
  })
  async startBooking(@Request() req, @Param("booking_id") bookingId: string) {
    return this.bookingsService.startBooking(req.user.id, bookingId);
  }

  @Post("gardener/bookings/:booking_id/complete")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Complete service" })
  @ApiParam({ name: "booking_id", description: "Booking ID" })
  @ApiResponse({
    status: 200,
    description: "Service completed successfully",
  })
  async completeBooking(
    @Request() req,
    @Param("booking_id") bookingId: string,
    @Body() completeDto: any
  ) {
    return this.bookingsService.completeBooking(req.user.id, bookingId, completeDto);
  }

  @Get("gardener/bookings/calendar")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get calendar view of bookings" })
  @ApiQuery({ name: "month", required: false, type: Number })
  @ApiQuery({ name: "year", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Calendar retrieved successfully",
  })
  async getGardenerCalendar(@Request() req, @Query() filterDto: any) {
    return this.bookingsService.getGardenerCalendar(req.user.id, filterDto);
  }
}
