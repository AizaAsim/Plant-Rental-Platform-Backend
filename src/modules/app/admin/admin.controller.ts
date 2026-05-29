import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { OrderComplaintsService } from "../orders/order-complaints.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Admin")
@Controller("api/v1/admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly orderComplaintsService: OrderComplaintsService
  ) {}

  // Users
  @Get("users")
  @ApiOperation({ summary: "List users" })
  async users(@Query() q: any) {
    return this.adminService.listUsers(q);
  }

  @Get("users/:user_id")
  @ApiOperation({ summary: "User details" })
  async user(@Param("user_id") id: string) {
    return this.adminService.getUser(id);
  }

  @Put("users/:user_id/status")
  @ApiOperation({ summary: "Activate/deactivate user" })
  async userStatus(@Param("user_id") id: string, @Body() body: any) {
    return this.adminService.updateUserStatus(id, body);
  }

  @Put("users/:user_id/verify")
  @ApiOperation({ summary: "Manually verify user" })
  async userVerify(@Param("user_id") id: string) {
    return this.adminService.verifyUser(id);
  }

  // Nurseries
  @Get("nurseries")
  @ApiOperation({ summary: "List nurseries" })
  async nurseries(@Query() q: any) {
    return this.adminService.listNurseries(q);
  }

  @Get("nurseries/:nursery_id")
  @ApiOperation({ summary: "Nursery details" })
  async nursery(@Param("nursery_id") id: string) {
    return this.adminService.getNursery(id);
  }

  @Put("nurseries/:nursery_id/verify")
  @ApiOperation({ summary: "Verify nursery" })
  async nurseryVerify(@Param("nursery_id") id: string, @Body() body: any) {
    return this.adminService.verifyNursery(id, body);
  }

  @Put("nurseries/:nursery_id/status")
  @ApiOperation({ summary: "Nursery active status" })
  async nurseryStatus(@Param("nursery_id") id: string, @Body() body: any) {
    return this.adminService.nurseryStatus(id, body);
  }

  // Gardeners
  @Get("gardeners")
  @ApiOperation({ summary: "List gardeners" })
  async gardeners(@Query() q: any) {
    return this.adminService.listGardeners(q);
  }

  @Get("gardeners/:gardener_id")
  @ApiOperation({ summary: "Gardener details" })
  async gardener(@Param("gardener_id") id: string) {
    return this.adminService.getGardener(id);
  }

  @Put("gardeners/:gardener_id/verify")
  @ApiOperation({ summary: "Verify gardener" })
  async gardenerVerify(@Param("gardener_id") id: string, @Body() body: any) {
    return this.adminService.verifyGardener(id, body);
  }

  // Orders
  @Get("orders")
  @ApiOperation({ summary: "List orders" })
  async orders(@Query() q: any) {
    return this.adminService.listOrders(q);
  }

  @Get("orders/:order_id")
  @ApiOperation({ summary: "Order details" })
  async order(@Param("order_id") id: string) {
    return this.adminService.getOrder(id);
  }

  // Bookings
  @Get("bookings")
  @ApiOperation({ summary: "List bookings" })
  async bookings(@Query() q: any) {
    return this.adminService.listBookings(q);
  }

  @Get("bookings/:booking_id")
  @ApiOperation({ summary: "Booking details" })
  async booking(@Param("booking_id") id: string) {
    return this.adminService.getBooking(id);
  }

  // Payouts
  @Get("payouts")
  @ApiOperation({ summary: "List payouts" })
  async payouts(@Query() q: any) {
    return this.adminService.listPayouts(q);
  }

  @Put("payouts/:payout_id/process")
  @ApiOperation({ summary: "Process payout" })
  async payoutProcess(@Param("payout_id") id: string, @Body() body: any) {
    return this.adminService.processPayout(id, body);
  }

  // Disputes
  @Get("disputes")
  @ApiOperation({ summary: "List disputes" })
  async disputes(@Query() q: any) {
    return this.adminService.listDisputes(q);
  }

  @Get("disputes/:dispute_id")
  @ApiOperation({ summary: "Dispute details" })
  async dispute(@Param("dispute_id") id: string) {
    return this.adminService.getDispute(id);
  }

  @Post("disputes/:dispute_id/message")
  @ApiOperation({ summary: "Admin message on dispute" })
  async disputeMsg(
    @Request() req,
    @Param("dispute_id") id: string,
    @Body() body: any
  ) {
    return this.adminService.addDisputeMessageAdmin(id, req.user.id, body);
  }

  @Put("disputes/:dispute_id/resolve")
  @ApiOperation({ summary: "Resolve dispute" })
  async disputeResolve(
    @Request() req,
    @Param("dispute_id") id: string,
    @Body() body: any
  ) {
    return this.adminService.resolveDispute(id, req.user.id, body);
  }

  // Featured plants
  @Get("featured-plants")
  @ApiOperation({ summary: "Featured plants" })
  async featured(@Query() q: any) {
    return this.adminService.listFeatured(q);
  }

  @Post("featured-plants")
  @ApiOperation({ summary: "Add featured plant" })
  async featuredCreate(@Body() body: any) {
    return this.adminService.createFeatured(body);
  }

  @Put("featured-plants/:id")
  @ApiOperation({ summary: "Update featured plant" })
  async featuredUpdate(@Param("id") id: string, @Body() body: any) {
    return this.adminService.updateFeatured(id, body);
  }

  @Delete("featured-plants/:id")
  @ApiOperation({ summary: "Remove featured plant" })
  async featuredDelete(@Param("id") id: string) {
    return this.adminService.deleteFeatured(id);
  }

  // Coupons
  @Get("coupons")
  @ApiOperation({ summary: "List coupons" })
  async coupons(@Query() q: any) {
    return this.adminService.listCoupons(q);
  }

  @Post("coupons")
  @ApiOperation({ summary: "Create coupon" })
  async couponCreate(@Body() body: any) {
    return this.adminService.createCoupon(body);
  }

  @Put("coupons/:coupon_id")
  @ApiOperation({ summary: "Update coupon" })
  async couponUpdate(@Param("coupon_id") id: string, @Body() body: any) {
    return this.adminService.updateCoupon(id, body);
  }

  @Delete("coupons/:coupon_id")
  @ApiOperation({ summary: "Deactivate coupon" })
  async couponDelete(@Param("coupon_id") id: string) {
    return this.adminService.deactivateCoupon(id);
  }

  // Settings — register specific paths before :key
  @Get("settings/commission")
  @ApiOperation({ summary: "Commission configuration" })
  async commissionGet() {
    return this.adminService.getCommission();
  }

  @Put("settings/commission")
  @ApiOperation({ summary: "Update commission rates" })
  async commissionPut(@Body() body: any) {
    return this.adminService.setCommission(body);
  }

  @Get("settings")
  @ApiOperation({ summary: "All platform settings" })
  async settings() {
    return this.adminService.listSettings();
  }

  @Put("settings/:key")
  @ApiOperation({ summary: "Upsert setting by key" })
  async settingPut(@Request() req, @Param("key") key: string, @Body() body: any) {
    return this.adminService.upsertSetting(decodeURIComponent(key), body, req.user.id);
  }

  // Categories
  @Get("categories")
  @ApiOperation({ summary: "Category tree" })
  async categories() {
    return this.adminService.listCategoriesTree();
  }

  @Post("categories")
  @ApiOperation({ summary: "Create category" })
  async categoryCreate(@Body() body: any) {
    return this.adminService.createCategory(body);
  }

  @Put("categories/:category_id")
  @ApiOperation({ summary: "Update category" })
  async categoryUpdate(@Param("category_id") id: string, @Body() body: any) {
    return this.adminService.updateCategory(id, body);
  }

  @Delete("categories/:category_id")
  @ApiOperation({ summary: "Delete category" })
  async categoryDelete(@Param("category_id") id: string) {
    return this.adminService.deleteCategory(id);
  }

  // Skills
  @Get("skills")
  @ApiOperation({ summary: "Gardener skills" })
  async skills() {
    return this.adminService.listSkills();
  }

  @Post("skills")
  @ApiOperation({ summary: "Create skill" })
  async skillCreate(@Body() body: any) {
    return this.adminService.createSkill(body);
  }

  @Delete("skills/:skill_id")
  @ApiOperation({ summary: "Delete skill" })
  async skillDelete(@Param("skill_id") id: string) {
    return this.adminService.deleteSkill(id);
  }

  @Get("order-complaints")
  @ApiOperation({
    summary: "List customer order complaints (admin dashboard)",
    description:
      "Ready for admin UI integration. Vendor and admin receive IN_APP notifications when customers POST /api/v1/orders/:order_id/complaints",
  })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async listOrderComplaints(
    @Query() q: { status?: string; page?: string; limit?: string }
  ) {
    return this.orderComplaintsService.listForAdmin({
      status: q.status,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  @Get("manual-orders")
  @ApiOperation({ summary: "Manual intervention queue (MISS-19)" })
  async manualOrders(@Query() q: { status?: string; priority?: string; page?: string; limit?: string }) {
    return this.adminService.listManualOrders(q);
  }

  @Post("manual-orders/:order_id/resolve")
  @ApiOperation({ summary: "Resolve manual case (MISS-20)" })
  async manualResolve(@Param("order_id") orderId: string, @Body() body: { action: string; note?: string }) {
    return this.adminService.resolveManualOrder(orderId, body);
  }

  @Get("settings/freelance-match-config")
  @ApiOperation({ summary: "Freelance auto-match config (MISS-12)" })
  async freelanceConfigGet() {
    return this.adminService.getFreelanceMatchConfig();
  }

  @Put("settings/freelance-match-config")
  @ApiOperation({ summary: "Update freelance auto-match config" })
  async freelanceConfigPut(
    @Body() body: { auto_match_enabled?: boolean; auto_match_score_threshold?: number; gardener_accept_window_minutes?: number }
  ) {
    return this.adminService.setFreelanceMatchConfig(body);
  }
}
