// src/modules/app/cart/cart.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
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
import { CartService } from "./cart.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Cart")
@Controller("api/v1/cart")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @Roles(UserRole.USER)
  @ApiOperation({ summary: "Get user's cart" })
  @ApiResponse({
    status: 200,
    description: "Cart retrieved successfully",
  })
  async getCart(@Request() req) {
    return this.cartService.getCart(req.user.id);
  }

  @Post("items")
  @Roles(UserRole.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Add item to cart" })
  @ApiResponse({
    status: 200,
    description: "Item added to cart successfully",
  })
  async addItem(@Request() req, @Body() addItemDto: any) {
    return this.cartService.addItem(req.user.id, addItemDto);
  }

  @Put("items/:item_id")
  @Roles(UserRole.USER)
  @ApiOperation({ summary: "Update cart item" })
  @ApiParam({ name: "item_id", description: "Cart Item ID" })
  @ApiResponse({
    status: 200,
    description: "Cart item updated successfully",
  })
  async updateItem(
    @Request() req,
    @Param("item_id") itemId: string,
    @Body() updateDto: any
  ) {
    return this.cartService.updateItem(req.user.id, itemId, updateDto);
  }

  @Delete("items/:item_id")
  @Roles(UserRole.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove item from cart" })
  @ApiParam({ name: "item_id", description: "Cart Item ID" })
  @ApiResponse({
    status: 200,
    description: "Item removed from cart successfully",
  })
  async removeItem(@Request() req, @Param("item_id") itemId: string) {
    return this.cartService.removeItem(req.user.id, itemId);
  }

  @Delete()
  @Roles(UserRole.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Clear entire cart" })
  @ApiResponse({
    status: 200,
    description: "Cart cleared successfully",
  })
  async clearCart(@Request() req) {
    return this.cartService.clearCart(req.user.id);
  }

  @Post("validate")
  @Roles(UserRole.USER)
  @ApiOperation({ summary: "Validate cart before checkout" })
  @ApiResponse({
    status: 200,
    description: "Cart validation completed",
  })
  async validateCart(@Request() req) {
    return this.cartService.validateCart(req.user.id);
  }

  @Post("apply-coupon")
  @Roles(UserRole.USER)
  @ApiOperation({ summary: "Apply coupon to cart" })
  @ApiResponse({
    status: 200,
    description: "Coupon applied successfully",
  })
  async applyCoupon(@Request() req, @Body() couponDto: any) {
    return this.cartService.applyCoupon(req.user.id, couponDto);
  }

  @Delete("coupon")
  @Roles(UserRole.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove applied coupon" })
  @ApiResponse({
    status: 200,
    description: "Coupon removed successfully",
  })
  async removeCoupon(@Request() req) {
    return this.cartService.removeCoupon(req.user.id);
  }

  @Post("packages")
  @Roles(UserRole.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Add package to cart" })
  @ApiResponse({
    status: 200,
    description: "Package added to cart successfully",
  })
  async addPackage(@Request() req, @Body() addPackageDto: any) {
    return this.cartService.addPackage(req.user.id, addPackageDto);
  }

  @Delete("packages/:item_id")
  @Roles(UserRole.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove package from cart" })
  @ApiParam({ name: "item_id", description: "Cart Package Item ID" })
  @ApiResponse({
    status: 200,
    description: "Package removed from cart successfully",
  })
  async removePackage(@Request() req, @Param("item_id") itemId: string) {
    return this.cartService.removePackage(req.user.id, itemId);
  }
}
