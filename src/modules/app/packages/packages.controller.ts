// src/modules/app/packages/packages.controller.ts
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
import { PackagesService } from "./packages.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Packages")
@Controller("api/v1/packages")
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  @ApiOperation({ summary: "Get all fixed packages" })
  @ApiResponse({
    status: 200,
    description: "Packages retrieved successfully",
  })
  async getAllPackages() {
    return this.packagesService.getAllPackages();
  }

  @Get(":package_id")
  @ApiOperation({ summary: "Get package details" })
  @ApiParam({ name: "package_id", description: "Package ID" })
  @ApiResponse({
    status: 200,
    description: "Package retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Package not found" })
  async getPackageById(@Param("package_id") packageId: string) {
    return this.packagesService.getPackageById(packageId);
  }

  @Post("custom")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create custom package" })
  @ApiResponse({
    status: 201,
    description: "Custom package created successfully",
  })
  async createCustomPackage(
    @Request() req,
    @Body() createDto: any
  ) {
    return this.packagesService.createCustomPackage(req.user.id, createDto);
  }

  @Get("custom")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user's custom packages" })
  @ApiResponse({
    status: 200,
    description: "Custom packages retrieved successfully",
  })
  async getUserCustomPackages(@Request() req) {
    return this.packagesService.getUserCustomPackages(req.user.id);
  }

  @Get("custom/:package_id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get custom package details" })
  @ApiParam({ name: "package_id", description: "Custom Package ID" })
  @ApiResponse({
    status: 200,
    description: "Custom package retrieved successfully",
  })
  async getCustomPackageById(
    @Request() req,
    @Param("package_id") packageId: string
  ) {
    return this.packagesService.getCustomPackageById(req.user.id, packageId);
  }

  @Put("custom/:package_id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update custom package" })
  @ApiParam({ name: "package_id", description: "Custom Package ID" })
  @ApiResponse({
    status: 200,
    description: "Custom package updated successfully",
  })
  async updateCustomPackage(
    @Request() req,
    @Param("package_id") packageId: string,
    @Body() updateDto: any
  ) {
    return this.packagesService.updateCustomPackage(req.user.id, packageId, updateDto);
  }

  @Delete("custom/:package_id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete custom package" })
  @ApiParam({ name: "package_id", description: "Custom Package ID" })
  @ApiResponse({
    status: 200,
    description: "Custom package deleted successfully",
  })
  async deleteCustomPackage(
    @Request() req,
    @Param("package_id") packageId: string
  ) {
    return this.packagesService.deleteCustomPackage(req.user.id, packageId);
  }
}
