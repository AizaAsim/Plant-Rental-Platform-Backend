import { Controller, Get, Query, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { OrdersService } from "./orders.service";
import { VENDOR_RENTAL_BUCKETS } from "./vendor-rental-buckets";

@ApiTags("Vendor rentals")
@Controller("api/v1/vendor/rentals")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
@ApiBearerAuth("bearer")
export class VendorRentalsController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: "Rental line-items by lifecycle bucket (counts + page)",
    description:
      "Canonical vendor rental board. **`ONGOING`** = active rental, end strictly after calendar today (or unknown end date). **`DUE_TODAY`** = ACTIVE/EXTENDED with `rent_end_date` on today. **`OVERDUE`** = `OVERDUE` status or ACTIVE/EXTENDED with end before today start. **`COMPLETED`** = `RETURNED`. " +
      "Also returns **`counts`** for badge totals. Uses server **local midnight** boundaries for calendar days.",
  })
  @ApiQuery({
    name: "bucket",
    required: false,
    enum: VENDOR_RENTAL_BUCKETS,
    description: "Defaults to ONGOING",
  })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async list(
    @Request() req: { user: { id: string } },
    @Query("bucket") bucket?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.ordersService.getVendorRentalsByBucket(req.user.id, { bucket, page, limit });
  }
}
