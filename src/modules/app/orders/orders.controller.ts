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
  ApiBody,
} from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { OrderContractFlowService } from "./order-contract-flow.service";
import { OrderComplaintsService } from "./order-complaints.service";
import {
  assignGardenerApiBody,
  completeDeliveryFulfillmentApiBody,
  customerDeliveryResponseApiBody,
  customerReturnResponseApiBody,
  proposeDeliverySlotsApiBody,
  vendorRejectOrderApiBody,
  vendorCompleteReturnApiBody,
  vendorInitiateReturnApiBody,
} from "./order-workflow.swagger";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole, OrderStatus, OrderType } from "@prisma/client";
import { UsersService } from "../users/users.service";

@ApiTags("Orders")
@Controller("api/v1/orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderContractFlow: OrderContractFlowService,
    private readonly orderComplaints: OrderComplaintsService,
    private readonly usersService: UsersService
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

  /** Spec path; same payload as `GET /api/v1/users/order-history` (must stay before `:order_id` routes). */
  @Get("history")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Order history (spec alias of GET /api/v1/users/order-history)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, enum: OrderStatus })
  @ApiQuery({ name: "order_type", required: false, enum: OrderType })
  @ApiResponse({ status: 200, description: "Order history retrieved successfully" })
  async getOrderHistorySpec(
    @Request() req,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: OrderStatus,
    @Query("order_type") orderType?: OrderType
  ) {
    return this.usersService.getOrderHistory(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
      orderType
    );
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
  @ApiTags("Orders", "workflowMeta · slots")
  @ApiBody(customerDeliveryResponseApiBody)
  @ApiOperation({
    summary: "Customer replies to proposed delivery slots — updates workflowMeta + order status",
    description:
      "**Path:** `POST /api/v1/orders/:order_id/customer-delivery-response`. " +
      "Uses `workflowMeta.delivery.proposed` from vendor propose. " +
      "`CONFIRM` may set `SLOT_CONFIRMED` (unpaid path, sets `paymentWindowExpiresAt`) or `OUT_FOR_DELIVERY` when already paid — see implementation.",
  })
  @ApiParam({ name: "order_id", description: "Order UUID or order number" })
  async customerDeliveryResponse(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.orderContractFlow.customerDeliveryResponse(req.user.id, orderId, body);
  }

  /** Phase 06: canonical path — same handler as vendor/orders/.../propose-delivery-slots */
  @Post(":order_id/propose-delivery-slots")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiTags("Orders", "workflowMeta · slots")
  @ApiBody(proposeDeliverySlotsApiBody)
  @ApiOperation({
    summary: "Vendor proposes delivery slots — merges workflowMeta.delivery, status → SLOT_PROPOSED",
    description:
      "**Path:** `POST /api/v1/orders/:order_id/propose-delivery-slots` (alias: `POST .../vendor/orders/:order_id/propose-delivery-slots`). " +
      "Order must be CONFIRMED or SLOT_PROPOSED. Server stores `slotExpiresAt` on the delivery object.",
  })
  @ApiParam({ name: "order_id", description: "Order UUID or order number" })
  async vendorProposeDeliverySlotsByOrderId(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.orderContractFlow.vendorProposeDeliverySlots(req.user.id, orderId, body);
  }

  @Post(":order_id/customer-return-response")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiTags("Orders", "workflowMeta · return")
  @ApiBody(customerReturnResponseApiBody)
  @ApiOperation({
    summary: "Customer return pickup response — reads workflowMeta.return.proposed",
    description: "**Path:** `POST /api/v1/orders/:order_id/customer-return-response`",
  })
  @ApiParam({ name: "order_id", description: "Order UUID or order number" })
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

  @Post(":order_id/complaints")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Submit order complaint (Foodpanda-style)",
    description:
      "Notifies vendor app and admin dashboard via in-app notifications. Admin list: GET /api/v1/admin/order-complaints",
  })
  async createOrderComplaint(
    @Request() req,
    @Param("order_id") orderId: string,
    @Body() body: { subject: string; description: string; attachments?: string[] }
  ) {
    return this.orderComplaints.create(req.user.id, orderId, body);
  }

  @Get("my-complaints")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List your order complaints" })
  async listMyComplaints(@Request() req, @Query() query: { page?: number; limit?: number }) {
    return this.orderComplaints.listForUser(req.user.id, query);
  }

  @Get(":order_id/fulfillment-summary")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiTags("Orders", "Proof of delivery · returns (customer)")
  @ApiOperation({
    summary: "Fulfillment audit for your order (proof URLs redacted)",
    description:
      "Same lifecycle fields as vendor fulfillment audit, but **`proof_urls` are never returned**: use **`proof_image_count`** + timestamps. **`workflow_meta_snapshot`** hides raw URL arrays under `proof_image_urls` / similar keys.",
  })
  @ApiParam({ name: "order_id", description: "Order UUID or order number" })
  async getCustomerFulfillmentSummary(@Request() req, @Param("order_id") orderId: string) {
    return this.ordersService.getCustomerFulfillmentSummary(req.user.id, orderId);
  }

  @Get(":order_id/line-items/:order_item_id/fulfillment-summary")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiTags("Orders", "Proof of delivery · returns (customer)")
  @ApiOperation({ summary: "Single line fulfillment summary (customer, URLs redacted)" })
  @ApiParam({ name: "order_id", description: "Order UUID or order number" })
  @ApiParam({ name: "order_item_id", description: "OrderItem UUID" })
  async getCustomerLineFulfillmentSummary(
    @Request() req,
    @Param("order_id") orderId: string,
    @Param("order_item_id") orderItemId: string
  ) {
    return this.ordersService.getCustomerLineFulfillmentSummary(req.user.id, orderId, orderItemId);
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
  @ApiOperation({
    summary: "Cancel order",
    description:
      "Allowed only while PENDING or CONFIRMED with unpaid payment (before slots or payment). Releases inventory only if vendor has already approved (stock reserved).",
  })
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

  @Get("vendor/orders/:order_id/fulfillment-audit")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiTags("Orders", "Proof of delivery · returns")
  @ApiOperation({
    summary: "Per-line delivery/return proof flags + workflowMeta excerpts",
    description:
      "**Path:** `GET /api/v1/orders/vendor/orders/:order_id/fulfillment-audit`. Reads persisted `OrderItem` delivery/return columns and a small `workflow_meta_snapshot` (delivery, delivery_completion, return).",
  })
  @ApiParam({ name: "order_id", description: "Order UUID or order number" })
  async getVendorFulfillmentAudit(@Request() req, @Param("order_id") orderId: string) {
    return this.ordersService.getVendorFulfillmentAudit(req.user.id, orderId);
  }

  @Get("vendor/orders/:order_id/line-items/:order_item_id/fulfillment")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiTags("Orders", "Proof of delivery · returns")
  @ApiOperation({
    summary: "Single order line fulfillment / proof-of-delivery & return audit",
    description:
      "**Path:** `GET …/line-items/:order_item_id/fulfillment` — same shaped `item` object as rows in fulfillment-audit `items[]`.",
  })
  @ApiParam({ name: "order_id", description: "Order UUID or order number" })
  @ApiParam({ name: "order_item_id", description: "OrderItem UUID" })
  async getVendorLineFulfillment(
    @Request() req,
    @Param("order_id") orderId: string,
    @Param("order_item_id") orderItemId: string
  ) {
    return this.ordersService.getVendorLineFulfillment(req.user.id, orderId, orderItemId);
  }

  @Get("vendor/orders/:order_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get order details (vendor view)" })
  @ApiParam({ name: "order_id", description: "Order UUID or order number" })
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
  @ApiTags("Orders", "workflowMeta · slots")
  @ApiBody(proposeDeliverySlotsApiBody)
  @ApiOperation({
    summary: "Propose delivery slots (vendor path — same body as POST .../orders/:order_id/propose-delivery-slots)",
    description: "**Path:** `POST /api/v1/orders/vendor/orders/:order_id/propose-delivery-slots`",
  })
  @ApiParam({ name: "order_id", description: "Order UUID or order number" })
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
  @ApiTags("Orders", "workflowMeta · return")
  @ApiBody(vendorInitiateReturnApiBody)
  @ApiOperation({
    summary: "Vendor initiate return — stores pickup options under workflowMeta.return",
    description: "**Path:** `POST /api/v1/orders/vendor/orders/:order_id/initiate-return`",
  })
  @ApiParam({ name: "order_id", description: "Order UUID or order number" })
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
  @ApiTags("Orders", "Proof of delivery · returns", "workflowMeta · return")
  @ApiBody(vendorCompleteReturnApiBody)
  @ApiOperation({
    summary: "Complete return — per-line condition, proof timestamps, conditional restock",
    description:
      "Persists return proof/condition/URLs, restock flags and restocked_at, actual_return_date. Requires items[] sized to pending rental rows. Sets order COMPLETED when every rental line is RETURNED.",
  })
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
  @ApiTags("Orders", "Proof of delivery · returns")
  @ApiBody(completeDeliveryFulfillmentApiBody)
  @ApiOperation({
    summary: "Complete delivery — activate rental clock + optional per-line proof",
    description:
      "Starts rental period (rent dates). Optionally send **`line_items[]`** so each rental row stores **`delivery_proof_at`**, condition, urls, notes. Order-level keys still merge into `workflowMeta.deliveryCompletion`.",
  })
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
  @ApiBody(vendorRejectOrderApiBody)
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

  @Get("vendor/complaints")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List complaints for vendor nursery orders" })
  async listVendorComplaints(@Request() req, @Query() query: { page?: number; limit?: number }) {
    return this.orderComplaints.listForVendor(req.user.id, query);
  }

  @Post("vendor/orders/:order_id/assign-gardener")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiTags("Orders", "workflowMeta · delivery assignment")
  @ApiBody(assignGardenerApiBody)
  @ApiOperation({
    summary: "Assign gardener for rental maintenance — optional workflowMeta.assignGardener",
    description:
      "**Path:** `POST /api/v1/orders/vendor/orders/:order_id/assign-gardener`. " +
      "Nursery staff only. When `delivery_slots` is sent, merged into `workflowMeta` alongside `gardener_id`.",
  })
  @ApiParam({ name: "order_id", description: "Order UUID" })
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
  @ApiOperation({
    summary: "[Legacy] List non-completed rental line-items",
    description:
      "Canonical buckets + counts: **`GET /api/v1/vendor/rentals?bucket=ONGOING|DUE_TODAY|OVERDUE|COMPLETED`**. " +
      "This path keeps the old `status` filter (`DUE_TODAY`, `OVERDUE`); default/`ACTIVE` returns ACTIVE+EXTENDED+OVERDUE rentals (not RETURNED).",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["ACTIVE", "OVERDUE", "DUE_TODAY"],
    description:
      "Prefer `GET /api/v1/vendor/rentals` with bucket. `ACTIVE` (or omitted) = all in-flight rental statuses.",
  })
  @ApiResponse({
    status: 200,
    description: "Active rentals retrieved successfully",
  })
  async getActiveRentals(@Request() req, @Query() filterDto: any) {
    return this.ordersService.getActiveRentals(req.user.id, filterDto);
  }
}
