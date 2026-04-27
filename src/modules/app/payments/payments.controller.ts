import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Payments")
@Controller("api/v1/payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("initiate")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Initiate payment (mock gateway)" })
  async initiate(@Request() req, @Body() body: any) {
    return this.paymentsService.initiate(req.user.id, body);
  }

  @Post("verify")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify payment after gateway callback (mock)" })
  async verify(@Request() req, @Body() body: any) {
    const key = (req.headers["idempotency-key"] || req.headers["Idempotency-Key"]) as string | undefined;
    return this.paymentsService.verify(req.user.id, body, key);
  }

  @Post("webhook")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Payment gateway webhook (mock)" })
  async webhook(@Body() body: any) {
    return this.paymentsService.webhook(body ?? {});
  }

  @Get("history")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Payment history" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "payment_type", required: false })
  @ApiQuery({ name: "date_from", required: false })
  @ApiQuery({ name: "date_to", required: false })
  async history(@Request() req, @Query() query: any) {
    return this.paymentsService.getHistory(req.user.id, query);
  }

  @Get(":payment_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Payment details" })
  @ApiParam({ name: "payment_id" })
  async getOne(@Request() req, @Param("payment_id") paymentId: string) {
    return this.paymentsService.getPaymentById(req.user.id, paymentId);
  }

  @Post(":payment_id/refund")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request refund (mock)" })
  @ApiParam({ name: "payment_id" })
  async refund(
    @Request() req,
    @Param("payment_id") paymentId: string,
    @Body() body: any
  ) {
    return this.paymentsService.requestRefund(req.user.id, paymentId, body);
  }
}
