import { Body, Controller, Get, Post, Put, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Notifications")
@Controller("api/v1/notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post("send")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Send notification (internal / admin)" })
  async send(@Body() body: any) {
    return this.notificationsService.sendInternal(body);
  }

  @Post("bulk-send")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Bulk send notifications (admin)" })
  async bulkSend(@Body() body: any) {
    return this.notificationsService.bulkSend(body);
  }

  @Get("settings")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get notification preferences" })
  async getSettings(@Request() req) {
    return this.notificationsService.getSettings(req.user.id);
  }

  @Put("settings")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update notification preferences" })
  async putSettings(@Request() req, @Body() body: any) {
    return this.notificationsService.updateSettings(req.user.id, body);
  }

  @Post("device-token")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Register device token for push" })
  async deviceToken(@Request() req, @Body() body: any) {
    return this.notificationsService.registerDeviceToken(req.user.id, body);
  }
}
