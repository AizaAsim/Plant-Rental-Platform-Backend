// src/modules/app/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { UpdateProfileDto, ProfileResponseDto } from "./dto/profile.dto";
import {
  CreateAddressDto,
  UpdateAddressDto,
  AddressResponseDto,
} from "./dto/address.dto";
import {
  UpdatePreferencesDto,
  PreferencesResponseDto,
} from "./dto/preferences.dto";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";

@ApiTags("Users")
@Controller("users")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Profile Endpoints
  @Get("profile")
  @ApiOperation({ summary: "Get user profile" })
  @ApiResponse({
    status: 200,
    description: "User profile retrieved successfully",
    type: ProfileResponseDto,
  })
  async getProfile(@Request() req): Promise<ProfileResponseDto> {
    return this.usersService.getProfile(req.user.id);
  }

  @Put("profile")
  @ApiOperation({ summary: "Update user profile" })
  @ApiResponse({
    status: 200,
    description: "Profile updated successfully",
    type: ProfileResponseDto,
  })
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto
  ): Promise<ProfileResponseDto> {
    return this.usersService.updateProfile(req.user.id, updateProfileDto);
  }

  // Address Endpoints
  @Get("addresses")
  @ApiOperation({ summary: "Get all user addresses" })
  @ApiResponse({
    status: 200,
    description: "Addresses retrieved successfully",
    type: [AddressResponseDto],
  })
  async getAddresses(@Request() req): Promise<AddressResponseDto[]> {
    return this.usersService.getAddresses(req.user.id);
  }

  @Post("addresses")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create new address" })
  @ApiResponse({
    status: 201,
    description: "Address created successfully",
    type: AddressResponseDto,
  })
  async createAddress(
    @Request() req,
    @Body() createAddressDto: CreateAddressDto
  ): Promise<AddressResponseDto> {
    return this.usersService.createAddress(req.user.id, createAddressDto);
  }

  @Put("addresses/:id")
  @ApiOperation({ summary: "Update address" })
  @ApiParam({ name: "id", description: "Address ID" })
  @ApiResponse({
    status: 200,
    description: "Address updated successfully",
    type: AddressResponseDto,
  })
  async updateAddress(
    @Request() req,
    @Param("id") addressId: string,
    @Body() updateAddressDto: UpdateAddressDto
  ): Promise<AddressResponseDto> {
    return this.usersService.updateAddress(
      req.user.id,
      addressId,
      updateAddressDto
    );
  }

  @Delete("addresses/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete address" })
  @ApiParam({ name: "id", description: "Address ID" })
  @ApiResponse({
    status: 200,
    description: "Address deleted successfully",
  })
  async deleteAddress(
    @Request() req,
    @Param("id") addressId: string
  ): Promise<{ message: string }> {
    return this.usersService.deleteAddress(req.user.id, addressId);
  }

  // Preferences Endpoints
  @Get("preferences")
  @ApiOperation({ summary: "Get user preferences" })
  @ApiResponse({
    status: 200,
    description: "Preferences retrieved successfully",
    type: PreferencesResponseDto,
  })
  async getPreferences(@Request() req): Promise<PreferencesResponseDto> {
    const preferences = await this.usersService.getPreferences(req.user.id);
    return {
      ...preferences,
      preferredCategories: Array.isArray(preferences.preferredCategories)
        ? preferences.preferredCategories.filter(
            (category): category is string => typeof category === "string"
          )
        : [preferences.preferredCategories].filter(
            (category): category is string => typeof category === "string"
          ),
    };
  }

  @Put("preferences")
  @ApiOperation({ summary: "Update user preferences" })
  @ApiResponse({
    status: 200,
    description: "Preferences updated successfully",
    type: PreferencesResponseDto,
  })
  async updatePreferences(
    @Request() req,
    @Body() updatePreferencesDto: UpdatePreferencesDto
  ): Promise<PreferencesResponseDto> {
    const preferences = await this.usersService.updatePreferences(
      req.user.id,
      updatePreferencesDto
    );
    return {
      ...preferences,
      preferredCategories: Array.isArray(preferences.preferredCategories)
        ? preferences.preferredCategories.filter(
            (category): category is string => typeof category === "string"
          )
        : [],
    };
  }
}
