import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Bank details")
@Controller("api/v1/bank-details")
export class BankDetailsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List bank accounts" })
  async list(@Request() req) {
    return this.paymentsService.listBankDetails(req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Add bank account (mock IFSC validation)" })
  async create(@Request() req, @Body() body: any) {
    return this.paymentsService.createBankDetail(req.user.id, body);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update bank account" })
  @ApiParam({ name: "id" })
  async update(@Request() req, @Param("id") id: string, @Body() body: any) {
    return this.paymentsService.updateBankDetail(req.user.id, id, body);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete bank account" })
  @ApiParam({ name: "id" })
  async remove(@Request() req, @Param("id") id: string) {
    return this.paymentsService.deleteBankDetail(req.user.id, id);
  }
}
