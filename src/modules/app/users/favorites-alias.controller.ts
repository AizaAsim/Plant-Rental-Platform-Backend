// Spec alias: /api/v1/favorites → wishlist (canonical: /api/v1/users/wishlist)
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { UsersService } from "./users.service";

@ApiTags("Favorites")
@Controller("api/v1/favorites")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER)
@ApiBearerAuth()
export class FavoritesAliasController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: "Get favorites (alias of GET /api/v1/users/wishlist)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async list(
    @Request() req,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.usersService.getWishlist(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20
    );
  }

  @Post(":plant_id")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add to favorites (alias of POST /api/v1/users/wishlist/:plant_id)" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  async add(@Request() req, @Param("plant_id") plantId: string) {
    return this.usersService.addToWishlist(req.user.id, plantId);
  }

  @Delete(":plant_id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove from favorites (alias of DELETE /api/v1/users/wishlist/:plant_id)" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  async remove(@Request() req, @Param("plant_id") plantId: string) {
    return this.usersService.removeFromWishlist(req.user.id, plantId);
  }
}
