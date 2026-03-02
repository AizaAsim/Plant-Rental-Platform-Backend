// src/modules/app/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { UpdateProfileDto } from "./dto/profile.dto";
import { CreateAddressDto, UpdateAddressDto } from "./dto/address.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { Prisma, RentalStatus, OrderStatus, BookingStatus, NotificationType, OrderType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

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
        nursery: true,
        gardener: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Remove password from response
    const { passwordHash, ...userWithoutPassword } = user;
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

      const updateData: Prisma.UserUpdateInput = {};
      if (updateProfileDto.full_name !== undefined) {
        updateData.fullName = updateProfileDto.full_name;
      }
      if (updateProfileDto.phone !== undefined) {
        updateData.phone = updateProfileDto.phone;
      }
      if (updateProfileDto.avatar_url !== undefined) {
        updateData.avatarUrl = updateProfileDto.avatar_url;
      }
      if (updateProfileDto.company_name !== undefined) {
        updateData.companyName = updateProfileDto.company_name;
      }
      if (updateProfileDto.gst_number !== undefined) {
        updateData.gstNumber = updateProfileDto.gst_number;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          avatarUrl: true,
          role: true,
          isCorporate: true,
          companyName: true,
          gstNumber: true,
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
    const addresses = await this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "asc" },
      ],
    });

    return addresses.map((addr) => ({
      ...addr,
      latitude: addr.latitude ? Number(addr.latitude) : null,
      longitude: addr.longitude ? Number(addr.longitude) : null,
    }));
  }

  async getAddress(userId: string, addressId: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });

    if (!address) {
      throw new NotFoundException("Address not found");
    }

    return {
      ...address,
      latitude: address.latitude ? Number(address.latitude) : null,
      longitude: address.longitude ? Number(address.longitude) : null,
    };
  }

  async createAddress(userId: string, createAddressDto: CreateAddressDto) {
    const { is_default, ...addressData } = createAddressDto;

    // If this is set as default, unset other default addresses
    if (is_default) {
      await this.prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    // Check if this is the first address - make it default
    const addressCount = await this.prisma.userAddress.count({
      where: { userId },
    });

    const address = await this.prisma.userAddress.create({
      data: {
        label: addressData.label,
        addressLine1: addressData.address_line1,
        addressLine2: addressData.address_line2,
        city: addressData.city,
        state: addressData.state,
        pincode: addressData.pincode,
        latitude: addressData.latitude ? new Decimal(addressData.latitude) : null,
        longitude: addressData.longitude ? new Decimal(addressData.longitude) : null,
        isDefault: is_default !== undefined ? is_default : addressCount === 0,
        userId,
      },
    });

    return {
      ...address,
      latitude: address.latitude ? Number(address.latitude) : null,
      longitude: address.longitude ? Number(address.longitude) : null,
    };
  }

  async updateAddress(
    userId: string,
    addressId: string,
    updateAddressDto: UpdateAddressDto
  ) {
    // Check if address belongs to user
    const address = await this.prisma.userAddress.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });

    if (!address) {
      throw new NotFoundException("Address not found");
    }

    const { is_default, ...addressData } = updateAddressDto;

    // If setting as default, unset other defaults
    if (is_default) {
      await this.prisma.userAddress.updateMany({
        where: {
          userId,
          NOT: { id: addressId },
        },
        data: { isDefault: false },
      });
    }

    const updateData: Prisma.UserAddressUpdateInput = {};
    if (addressData.label !== undefined) updateData.label = addressData.label;
    if (addressData.address_line1 !== undefined) updateData.addressLine1 = addressData.address_line1;
    if (addressData.address_line2 !== undefined) updateData.addressLine2 = addressData.address_line2;
    if (addressData.city !== undefined) updateData.city = addressData.city;
    if (addressData.state !== undefined) updateData.state = addressData.state;
    if (addressData.pincode !== undefined) updateData.pincode = addressData.pincode;
    if (addressData.latitude !== undefined) updateData.latitude = new Decimal(addressData.latitude);
    if (addressData.longitude !== undefined) updateData.longitude = new Decimal(addressData.longitude);
    if (is_default !== undefined) updateData.isDefault = is_default;

    const updatedAddress = await this.prisma.userAddress.update({
      where: { id: addressId },
      data: updateData,
    });

    return {
      ...updatedAddress,
      latitude: updatedAddress.latitude ? Number(updatedAddress.latitude) : null,
      longitude: updatedAddress.longitude ? Number(updatedAddress.longitude) : null,
    };
  }

  async deleteAddress(userId: string, addressId: string) {
    // Check if address belongs to user
    const address = await this.prisma.userAddress.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });

    if (!address) {
      throw new NotFoundException("Address not found");
    }

    // Check if address is in use by any active orders
    const activeOrders = await this.prisma.order.count({
      where: {
        userId,
        deliveryAddressId: addressId,
        status: {
          in: [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING,
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.DELIVERED,
          ],
        },
      },
    });

    if (activeOrders > 0) {
      throw new BadRequestException(
        "Cannot delete address while having active orders"
      );
    }

    await this.prisma.userAddress.delete({
      where: { id: addressId },
    });

    // If deleted address was default, set another as default
    if (address.isDefault) {
      const firstAddress = await this.prisma.userAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });

      if (firstAddress) {
        await this.prisma.userAddress.update({
          where: { id: firstAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return { message: "Address deleted successfully" };
  }

  // Wishlist Management
  async getWishlist(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.wishlist.findMany({
        where: { userId },
        include: {
          plant: {
            include: {
              images: {
                where: { isPrimary: true },
                take: 1,
              },
              nursery: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.wishlist.count({
        where: { userId },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addToWishlist(userId: string, plantId: string) {
    // Check if plant exists and is active
    const plant = await this.prisma.plant.findFirst({
      where: {
        id: plantId,
        isActive: true,
      },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found or inactive");
    }

    // Check if already in wishlist
    const existing = await this.prisma.wishlist.findUnique({
      where: {
        userId_plantId: {
          userId,
          plantId,
        },
      },
    });

    if (existing) {
      throw new ConflictException("Plant already in wishlist");
    }

    const wishlistItem = await this.prisma.wishlist.create({
      data: {
        userId,
        plantId,
      },
      include: {
        plant: {
          include: {
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
      },
    });

    return { message: "Plant added to wishlist successfully", item: wishlistItem };
  }

  async removeFromWishlist(userId: string, plantId: string) {
    const wishlistItem = await this.prisma.wishlist.findUnique({
      where: {
        userId_plantId: {
          userId,
          plantId,
        },
      },
    });

    if (!wishlistItem) {
      throw new NotFoundException("Plant not found in wishlist");
    }

    await this.prisma.wishlist.delete({
      where: {
        userId_plantId: {
          userId,
          plantId,
        },
      },
    });

    return { message: "Plant removed from wishlist successfully" };
  }

  // Notifications Management
  async getNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    type?: NotificationType,
    isRead?: boolean
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      userId,
    };

    if (type) {
      where.type = type;
    }

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markNotificationAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return updated;
  }

  async markAllNotificationsAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      message: "All notifications marked as read",
      count: result.count,
    };
  }

  // Rented Plants
  async getRentedPlants(userId: string, status?: RentalStatus) {
    const where: Prisma.OrderItemWhereInput = {
      order: {
        userId,
        orderType: "RENT",
      },
    };

    if (status) {
      where.rentalStatus = status;
    }

    const orderItems = await this.prisma.orderItem.findMany({
      where,
      include: {
        plant: {
          include: {
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return orderItems;
  }

  // Order History
  async getOrderHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: OrderStatus,
    orderType?: OrderType
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      userId,
    };

    if (status) {
      where.status = status;
    }

    if (orderType) {
      where.orderType = orderType;
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              plant: {
                include: {
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          },
          nursery: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Booking History
  async getBookingHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: BookingStatus
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceBookingWhereInput = {
      userId,
    };

    if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      this.prisma.serviceBooking.findMany({
        where,
        include: {
          gardener: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.serviceBooking.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
