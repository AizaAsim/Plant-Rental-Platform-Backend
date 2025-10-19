// src/modules/app/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { UpdateProfileDto } from "./dto/profile.dto";
import { CreateAddressDto, UpdateAddressDto } from "./dto/address.dto";
import { UpdatePreferencesDto } from "./dto/preferences.dto";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Profile Management
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: {
          orderBy: { isDefault: "desc" },
        },
        _count: {
          select: {
            rentals: true,
            purchases: true,
            reviews: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    try {
      // Check if phone number is already taken by another user
      if (updateProfileDto.phone) {
        const existingUser = await this.prisma.user.findFirst({
          where: {
            phone: updateProfileDto.phone,
            NOT: { id: userId },
          },
        });

        if (existingUser) {
          throw new ConflictException("Phone number already in use");
        }
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...updateProfileDto,
          dateOfBirth: updateProfileDto.dateOfBirth
            ? new Date(updateProfileDto.dateOfBirth)
            : undefined,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          dateOfBirth: true,
          role: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return updatedUser;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      if (error.code === "P2025") {
        throw new NotFoundException("User not found");
      }
      throw error;
    }
  }

  // Address Management
  async getAddresses(userId: string) {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: "desc" }, // Removed createdAt
    });

    return addresses;
  }

  async createAddress(userId: string, createAddressDto: CreateAddressDto) {
    const { isDefault, ...addressData } = createAddressDto;

    // If this is set as default, unset other default addresses
    if (isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    // Check if this is the first address - make it default
    const addressCount = await this.prisma.address.count({
      where: { userId },
    });

    const address = await this.prisma.address.create({
      data: {
        ...addressData,
        country: addressData.country || "Pakistan",
        isDefault: isDefault || addressCount === 0,
        userId,
      },
    });

    return address;
  }

  async updateAddress(
    userId: string,
    addressId: string,
    updateAddressDto: UpdateAddressDto
  ) {
    // Check if address belongs to user
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });

    if (!address) {
      throw new NotFoundException("Address not found");
    }

    const { isDefault, ...addressData } = updateAddressDto;

    // If setting as default, unset other defaults
    if (isDefault) {
      await this.prisma.address.updateMany({
        where: {
          userId,
          NOT: { id: addressId },
        },
        data: { isDefault: false },
      });
    }

    const updatedAddress = await this.prisma.address.update({
      where: { id: addressId },
      data: {
        ...addressData,
        isDefault: isDefault !== undefined ? isDefault : address.isDefault,
      },
    });

    return updatedAddress;
  }

  async deleteAddress(userId: string, addressId: string) {
    // Check if address belongs to user
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });

    if (!address) {
      throw new NotFoundException("Address not found");
    }

    // Check if address is in use by any active orders
    const activeOrders = await this.prisma.$transaction([
      this.prisma.rental.count({
        where: {
          userId,
          status: {
            in: ["PENDING", "CONFIRMED", "DELIVERED", "ACTIVE"],
          },
        },
      }),
      this.prisma.purchase.count({
        where: {
          userId,
          status: {
            in: ["PENDING", "CONFIRMED", "DELIVERED"],
          },
        },
      }),
    ]);

    const totalActiveOrders = activeOrders[0] + activeOrders[1];
    if (totalActiveOrders > 0) {
      throw new BadRequestException(
        "Cannot delete address while having active orders"
      );
    }

    await this.prisma.address.delete({
      where: { id: addressId },
    });

    // If deleted address was default, set another as default
    if (address.isDefault) {
      const firstAddress = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { id: "asc" }, // Replace createdAt with a valid property
      });

      if (firstAddress) {
        await this.prisma.address.update({
          where: { id: firstAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return { message: "Address deleted successfully" };
  }

  // Preferences Management
  async getPreferences(userId: string) {
    // Check if preferences exist, if not create default ones
    let preferences = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await this.prisma.userPreferences.create({
        data: {
          userId,
          emailNotifications: true,
          smsNotifications: false,
          pushNotifications: true,
          marketingEmails: false,
          rentalReminders: true,
          maintenanceUpdates: true,
          language: "en",
          theme: "light",
          currency: "PKR",
          defaultDeliveryRadius: 10,
          preferredCategories: [],
        },
      });
    }

    return preferences;
  }

  async updatePreferences(
    userId: string,
    updatePreferencesDto: UpdatePreferencesDto
  ) {
    // Upsert preferences (create if doesn't exist, update if exists)
    const preferences = await this.prisma.userPreferences.upsert({
      where: { userId },
      update: updatePreferencesDto,
      create: {
        userId,
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        marketingEmails: false,
        rentalReminders: true,
        maintenanceUpdates: true,
        language: "en",
        theme: "light",
        currency: "PKR",
        defaultDeliveryRadius: 10,
        preferredCategories: [],
        ...updatePreferencesDto,
      },
    });

    return preferences;
  }
}
