// src/modules/app/orders/orders.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
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
import { OrdersService } from "./orders.service";
import { OrderContractFlowService } from "./order-contract-flow.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Orders")
@Controller("api/v1/orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderContractFlow: OrderContractFlowService
  ) {}

  @Post("checkout")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create order from cart" })
  @ApiResponse({
    status: 201,
    description: "Order created successfully",
  })
  @ApiResponse({ status: 400, description: "Cart validation failed" })
  async checkout(@Request() req, @Body() checkoutDto: any) {
    return this.ordersService.checkout(req.user.id, checkoutDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user's orders" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "order_type", required: false })
  @ApiQuery({ name: "date_from", required: false, type: String })
  @ApiQuery({ name: "date_to", required: false, type: String })
  @ApiResponse({
    status: 200,
    description: "Orders retrieved successfully",
  })
  async getUserOrders(@Request() req, @Query() filterDto: any) {
    return this.ordersService.getUserOrders(req.user.id, filterDto);
  }

  @Get("customer/active-rentals")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List customer's active rentals (order lines)" })
  @ApiResponse({ status: 200, description: "Active rentals retrieved" })
  async getCustomerActiveRentals(@Request() req) {
    return this.ordersService.getCustomerActiveRentals(req.user.id);
  }

  // --- Contract v3.1: delivery / return / penalty (user) ---
  @Post(":order_id/customer-delivery-response")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Customer confirms or requests different delivery slot (MISS-03)" })
  async customerDeliveryResponse(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.orderContractFlow.customerDeliveryResponse(req.user.id, orderId, body);
  }

  @Post(":order_id/customer-return-response")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Customer return pickup response (MISS-22)" })
  async customerReturnResponse(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.orderContractFlow.customerReturnResponse(req.user.id, orderId, body);
  }

  @Get(":order_id/penalty")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Penalty summary (MISS-09)" })
  async getOrderPenalty(@Request() req, @Param("order_id") orderId: string) {
    return this.orderContractFlow.getPenalty(req.user.id, orderId);
  }

  @Post(":order_id/finalize-penalty")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Finalize penalty on collection (MISS-10)" })
  async finalizePenalty(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.orderContractFlow.finalizePenalty(req.user.id, orderId, body);
  }

  @Get(":order_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get order details" })
  @ApiParam({ name: "order_id", description: "Order ID" })
  @ApiResponse({
    status: 200,
    description: "Order details retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Order not found" })
  async getOrderById(@Request() req, @Param("order_id") orderId: string) {
    return this.ordersService.getOrderById(req.user.id, orderId);
  }

  @Get(":order_id/tracking")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get order tracking info" })
  @ApiParam({ name: "order_id", description: "Order ID" })
  @ApiResponse({
    status: 200,
    description: "Tracking info retrieved successfully",
  })
  async getOrderTracking(@Request() req, @Param("order_id") orderId: string) {
    return this.ordersService.getOrderTracking(req.user.id, orderId);
  }

  @Post(":order_id/cancel")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancel order" })
  @ApiParam({ name: "order_id", description: "Order ID" })
  @ApiResponse({
    status: 200,
    description: "Order cancelled successfully",
  })
  @ApiResponse({ status: 400, description: "Order cannot be cancelled" })
  async cancelOrder(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() cancelDto: any
  ) {
    return this.ordersService.cancelOrder(req.user.id, orderId, cancelDto);
  }

  @Post(":order_id/items/:item_id/extend-rental")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Extend rental period" })
  @ApiParam({ name: "order_id", description: "Order ID" })
  @ApiParam({ name: "item_id", description: "Order Item ID" })
  @ApiResponse({
    status: 200,
    description: "Rental extended successfully",
  })
  async extendRental(
    @Request() req,
    @Param("order_id") orderId: string,
    @Param("item_id") itemId: string,
    @Body() extendDto: any
  ) {
    return this.ordersService.extendRental(req.user.id, orderId, itemId, extendDto);
  }

  @Post(":order_id/items/:item_id/return")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Initiate rental return" })
  @ApiParam({ name: "order_id", description: "Order ID" })
  @ApiParam({ name: "item_id", description: "Order Item ID" })
  @ApiResponse({
    status: 200,
    description: "Return initiated successfully",
  })
  async initiateReturn(
    @Request() req,
    @Param("order_id") orderId: string,
    @Param("item_id") itemId: string,
    @Body() returnDto: any
  ) {
    return this.ordersService.initiateReturn(req.user.id, orderId, itemId, returnDto);
  }

  // ========== VENDOR ORDER MANAGEMENT ==========

  @Get("vendor/orders")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get orders for vendor's nursery" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "order_type", required: false })
  @ApiQuery({ name: "date_from", required: false, type: String })
  @ApiQuery({ name: "date_to", required: false, type: String })
  @ApiResponse({
    status: 200,
    description: "Orders retrieved successfully",
  })
  async getVendorOrders(@Request() req, @Query() filterDto: any) {
    return this.ordersService.getVendorOrders(req.user.id, filterDto);
  }

  @Get("vendor/orders/stats")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get order statistics" })
  @ApiQuery({ name: "period", required: false, enum: ["day", "week", "month", "year"] })
  @ApiResponse({
    status: 200,
    description: "Statistics retrieved successfully",
  })
  async getVendorOrderStats(@Request() req, @Query("period") period?: string) {
    return this.ordersService.getVendorOrderStats(req.user.id, period || "month");
  }

  @Get("vendor/orders/:order_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get order details (vendor view)" })
  @ApiParam({ name: "order_id", description: "Order ID" })
  @ApiResponse({
    status: 200,
    description: "Order details retrieved successfully",
  })
  async getVendorOrder(@Request() req, @Param("order_id") orderId: string) {
    return this.ordersService.getVendorOrder(req.user.id, orderId);
  }

  @Get("vendor/orders/:order_id/payment-status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Payment status for vendor (before process order)" })
  @ApiParam({ name: "order_id" })
  async getVendorOrderPaymentStatus(
    @Request() req,
    @Param("order_id") orderId: string
  ) {
    return this.ordersService.getVendorOrderPaymentStatus(req.user.id, orderId);
  }

  @Put("vendor/orders/:order_id/approve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Approve order with plant_selections[]" })
  @ApiParam({ name: "order_id" })
  async vendorApproveOrder(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() body: any
  ) {
    return this.ordersService.vendorApproveOrder(req.user.id, orderId, body);
  }

  @Post("vendor/orders/:order_id/process")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send order to processing (after payment confirmed)" })
  @ApiParam({ name: "order_id" })
  async vendorProcessOrder(@Request() req, @Param("order_id") orderId: string) {
    return this.ordersService.vendorProcessOrder(req.user.id, orderId);
  }

  @Post("vendor/orders/:order_id/propose-delivery-slots")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Propose delivery slots (MOD-02)" })
  @ApiParam({ name: "order_id" })
  async vendorProposeDeliverySlots(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.orderContractFlow.vendorProposeDeliverySlots(req.user.id, orderId, body);
  }

  @Post("vendor/orders/:order_id/initiate-return")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Vendor initiate return pickup (MISS-17)" })
  @ApiParam({ name: "order_id" })
  async vendorInitiateReturn(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.orderContractFlow.vendorInitiateReturn(req.user.id, orderId, body);
  }

  @Post("vendor/orders/:order_id/complete-return")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Complete return with per-item condition (MISS-18)" })
  @ApiParam({ name: "order_id" })
  async vendorCompleteReturn(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.orderContractFlow.vendorCompleteReturn(req.user.id, orderId, body);
  }

  @Post("vendor/orders/:order_id/complete-delivery")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Complete delivery — activate rental clock" })
  @ApiParam({ name: "order_id" })
  async vendorCompleteDelivery(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() body?: Record<string, unknown>
  ) {
    return this.ordersService.vendorCompleteDelivery(req.user.id, orderId, body);
  }

  @Put("vendor/orders/:order_id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update order status" })
  @ApiParam({ name: "order_id", description: "Order ID" })
  @ApiResponse({
    status: 200,
    description: "Order status updated successfully",
  })
  async updateOrderStatus(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() statusDto: any
  ) {
    return this.ordersService.updateOrderStatus(req.user.id, orderId, statusDto);
  }

  @Post("vendor/orders/:order_id/reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reject order" })
  @ApiParam({ name: "order_id", description: "Order ID" })
  @ApiResponse({
    status: 200,
    description: "Order rejected successfully",
  })
  async rejectOrder(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() rejectDto: any
  ) {
    return this.ordersService.rejectOrder(req.user.id, orderId, rejectDto);
  }

  @Post("vendor/orders/:order_id/assign-gardener")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Assign gardener for rental maintenance" })
  @ApiParam({ name: "order_id", description: "Order ID" })
  @ApiResponse({
    status: 200,
    description: "Gardener assigned successfully",
  })
  async assignGardener(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() assignDto: any
  ) {
    return this.ordersService.assignGardener(req.user.id, orderId, assignDto);
  }

  @Get("vendor/rentals/active")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get active rentals" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, enum: ["ACTIVE", "OVERDUE", "DUE_TODAY"] })
  @ApiResponse({
    status: 200,
    description: "Active rentals retrieved successfully",
  })
  async getActiveRentals(@Request() req, @Query() filterDto: any) {
    return this.ordersService.getActiveRentals(req.user.id, filterDto);
  }
}
