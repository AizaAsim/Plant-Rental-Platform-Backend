// src/modules/app/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { UpdateProfileDto, ProfileResponseDto } from "./dto/profile.dto";
import {
  CreateAddressDto,
  UpdateAddressDto,
  AddressResponseDto,
} from "./dto/address.dto";
import { WishlistItemDto } from "./dto/wishlist.dto";
import { NotificationDto } from "./dto/notifications.dto";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RentalStatus, OrderStatus, BookingStatus, NotificationType, OrderType } from "@prisma/client";

@ApiTags("Users")
@Controller("api/v1/users")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Profile Endpoints
  @Get("profile")
  @ApiOperation({ summary: "Get current user's full profile" })
  @ApiResponse({
    status: 200,
    description: "User profile retrieved successfully",
    type: ProfileResponseDto,
  })
  async getProfile(@Request() req): Promise<ProfileResponseDto> {
    return this.usersService.getProfile(req.user.id);
  }

  @Put("profile")
  @ApiOperation({ summary: "Update user profile" })
  @ApiResponse({
    status: 200,
    description: "Profile updated successfully",
    type: ProfileResponseDto,
  })
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto
  ): Promise<ProfileResponseDto> {
    return this.usersService.updateProfile(req.user.id, updateProfileDto);
  }

  // Address Endpoints
  @Get("addresses")
  @ApiOperation({ summary: "Get all addresses for user" })
  @ApiResponse({
    status: 200,
    description: "Addresses retrieved successfully",
    type: [AddressResponseDto],
  })
  async getAddresses(@Request() req): Promise<AddressResponseDto[]> {
    return this.usersService.getAddresses(req.user.id);
  }

  @Get("addresses/:address_id")
  @ApiOperation({ summary: "Get specific address" })
  @ApiParam({ name: "address_id", description: "Address ID" })
  @ApiResponse({
    status: 200,
    description: "Address retrieved successfully",
    type: AddressResponseDto,
  })
  async getAddress(
    @Request() req,
    @Param("address_id") addressId: string
  ): Promise<AddressResponseDto> {
    return this.usersService.getAddress(req.user.id, addressId);
  }

  @Post("addresses")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add new address" })
  @ApiResponse({
    status: 201,
    description: "Address created successfully",
    type: AddressResponseDto,
  })
  async createAddress(
    @Request() req,
    @Body() createAddressDto: CreateAddressDto
  ): Promise<AddressResponseDto> {
    return this.usersService.createAddress(req.user.id, createAddressDto);
  }

  @Put("addresses/:address_id")
  @ApiOperation({ summary: "Update address" })
  @ApiParam({ name: "address_id", description: "Address ID" })
  @ApiResponse({
    status: 200,
    description: "Address updated successfully",
    type: AddressResponseDto,
  })
  async updateAddress(
    @Request() req,
    @Param("address_id") addressId: string,
    @Body() updateAddressDto: UpdateAddressDto
  ): Promise<AddressResponseDto> {
    return this.usersService.updateAddress(
      req.user.id,
      addressId,
      updateAddressDto
    );
  }

  @Delete("addresses/:address_id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete address" })
  @ApiParam({ name: "address_id", description: "Address ID" })
  @ApiResponse({
    status: 200,
    description: "Address deleted successfully",
  })
  async deleteAddress(
    @Request() req,
    @Param("address_id") addressId: string
  ): Promise<{ message: string }> {
    return this.usersService.deleteAddress(req.user.id, addressId);
  }

  // Wishlist Endpoints
  @Get("wishlist")
  @ApiOperation({ summary: "Get user's wishlist" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Wishlist retrieved successfully",
  })
  async getWishlist(
    @Request() req,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.usersService.getWishlist(
      req.user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  @Post("wishlist/:plant_id")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add plant to wishlist" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({
    status: 201,
    description: "Plant added to wishlist successfully",
  })
  async addToWishlist(
    @Request() req,
    @Param("plant_id") plantId: string
  ): Promise<{ message: string }> {
    return this.usersService.addToWishlist(req.user.id, plantId);
  }

  @Delete("wishlist/:plant_id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove plant from wishlist" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({
    status: 200,
    description: "Plant removed from wishlist successfully",
  })
  async removeFromWishlist(
    @Request() req,
    @Param("plant_id") plantId: string
  ): Promise<{ message: string }> {
    return this.usersService.removeFromWishlist(req.user.id, plantId);
  }

  // Notifications Endpoints
  @Get("notifications")
  @ApiOperation({ summary: "Get user notifications" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "type", required: false, enum: NotificationType })
  @ApiQuery({ name: "is_read", required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: "Notifications retrieved successfully",
    type: [NotificationDto],
  })
  async getNotifications(
    @Request() req,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("type") type?: NotificationType,
    @Query("is_read") isRead?: string
  ) {
    return this.usersService.getNotifications(
      req.user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      type,
      isRead !== undefined ? isRead === "true" : undefined
    );
  }

  @Put("notifications/:notification_id/read")
  @ApiOperation({ summary: "Mark notification as read" })
  @ApiParam({ name: "notification_id", description: "Notification ID" })
  @ApiResponse({
    status: 200,
    description: "Notification marked as read",
    type: NotificationDto,
  })
  async markNotificationAsRead(
    @Request() req,
    @Param("notification_id") notificationId: string
  ): Promise<NotificationDto> {
    return this.usersService.markNotificationAsRead(req.user.id, notificationId);
  }

  @Put("notifications/read-all")
  @ApiOperation({ summary: "Mark all notifications as read" })
  @ApiResponse({
    status: 200,
    description: "All notifications marked as read",
  })
  async markAllNotificationsAsRead(@Request() req) {
    return this.usersService.markAllNotificationsAsRead(req.user.id);
  }

  // Rented Plants
  @Get("rented-plants")
  @ApiOperation({ summary: "Get user's currently rented plants" })
  @ApiQuery({ name: "status", required: false, enum: RentalStatus })
  @ApiResponse({
    status: 200,
    description: "Rented plants retrieved successfully",
  })
  async getRentedPlants(
    @Request() req,
    @Query("status") status?: RentalStatus
  ) {
    return this.usersService.getRentedPlants(req.user.id, status);
  }

  // Order History
  @Get("order-history")
  @ApiOperation({ summary: "Get user's order history" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, enum: OrderStatus })
  @ApiQuery({ name: "order_type", required: false, enum: OrderType })
  @ApiResponse({
    status: 200,
    description: "Order history retrieved successfully",
  })
  async getOrderHistory(
    @Request() req,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: OrderStatus,
    @Query("order_type") orderType?: OrderType
  ) {
    return this.usersService.getOrderHistory(
      req.user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
      orderType
    );
  }

  // Booking History
  @Get("booking-history")
  @ApiOperation({ summary: "Get user's service booking history" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, enum: BookingStatus })
  @ApiResponse({
    status: 200,
    description: "Booking history retrieved successfully",
  })
  async getBookingHistory(
    @Request() req,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: BookingStatus
  ) {
    return this.usersService.getBookingHistory(
      req.user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status
    );
  }
}
