// src/modules/app/cart/cart.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { Prisma, OrderType } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  // Helper: Get or create cart
  private async getOrCreateCart(userId: string) {
    let cart = await this.prisma.cart.findFirst({
      where: { userId },
      include: {
        items: {
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
                    city: true,
                  },
                },
              },
            },
          },
        },
        packageItems: {
          include: {
            package: {
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
              },
            },
            customPackage: {
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
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: {
          items: {
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
                      city: true,
                    },
                  },
                },
              },
            },
          },
          packageItems: {
            include: {
              package: {
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
                },
              },
              customPackage: {
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
                },
              },
            },
          },
        },
      });
    }

    return cart;
  }

  // Helper: Calculate cart summary
  private calculateCartSummary(cart: any) {
    let subtotal = new Decimal(0);
    let totalDeposit = new Decimal(0);
    let itemsCount = 0;

    // Calculate from plant items
    for (const item of cart.items) {
      const plant = item.plant;
      let unitPrice = new Decimal(0);

      if (item.orderType === OrderType.RENT && plant.rentPriceMonthly) {
        // Calculate monthly rent for the rental period
        const startDate = new Date(item.rentStartDate);
        const endDate = new Date(item.rentEndDate);
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const months = days / 30;
        unitPrice = plant.rentPriceMonthly.times(months);
      } else if (item.orderType === OrderType.BUY && plant.buyPrice) {
        unitPrice = plant.buyPrice;
      }

      const itemTotal = unitPrice.times(item.quantity);
      subtotal = subtotal.plus(itemTotal);

      if (plant.depositAmount) {
        totalDeposit = totalDeposit.plus(plant.depositAmount.times(item.quantity));
      }

      itemsCount += item.quantity;
    }

    // Calculate from package items
    for (const packageItem of cart.packageItems) {
      if (packageItem.package) {
        subtotal = subtotal.plus(packageItem.package.price.times(packageItem.quantity));
        itemsCount += packageItem.quantity;
      } else if (packageItem.customPackage) {
        subtotal = subtotal.plus(packageItem.customPackage.price.times(packageItem.quantity));
        itemsCount += packageItem.quantity;
      }
    }

    // Group by nursery for delivery estimation
    const nurseries = new Set<string>();
    cart.items.forEach((item: any) => {
      if (item.plant?.nursery?.id) {
        nurseries.add(item.plant.nursery.id);
      }
    });

    const estimatedDelivery = nurseries.size * 50; // 50 per nursery (example)

    return {
      subtotal: Number(subtotal),
      total_deposit: Number(totalDeposit),
      estimated_delivery: estimatedDelivery,
      items_count: itemsCount,
    };
  }

  // GET /api/v1/cart
  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    const summary = this.calculateCartSummary(cart);

    return {
      id: cart.id,
      items: cart.items.map((item: any) => ({
        id: item.id,
        plant: item.plant,
        quantity: item.quantity,
        order_type: item.orderType,
        rent_start_date: item.rentStartDate,
        rent_end_date: item.rentEndDate,
        unit_price: item.orderType === OrderType.RENT
          ? Number(item.plant.rentPriceMonthly || 0)
          : Number(item.plant.buyPrice || 0),
        total_price: item.orderType === OrderType.RENT
          ? Number(item.plant.rentPriceMonthly || 0) * item.quantity
          : Number(item.plant.buyPrice || 0) * item.quantity,
        deposit_amount: Number(item.plant.depositAmount || 0),
      })),
      package_items: cart.packageItems.map((pkgItem: any) => ({
        id: pkgItem.id,
        package: pkgItem.package,
        custom_package: pkgItem.customPackage,
        quantity: pkgItem.quantity,
      })),
      summary,
    };
  }

  // POST /api/v1/cart/items
  async addItem(userId: string, addItemDto: any) {
    const { plant_id, quantity = 1, order_type, rent_start_date, rent_end_date } = addItemDto ?? {};
    if (!plant_id) {
      throw new BadRequestException("plant_id is required");
    }
    if (!order_type) {
      throw new BadRequestException("order_type is required (RENT or BUY)");
    }

    // Validate plant
    const plant = await this.prisma.plant.findFirst({
      where: {
        id: plant_id,
        isActive: true,
        stockQuantity: { gt: 0 },
        nursery: {
          isActive: true,
          isVerified: true,
        },
      },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found or unavailable");
    }

    // Validate order type
    if (order_type === OrderType.RENT) {
      if (!plant.isAvailableForRent) {
        throw new BadRequestException("Plant is not available for rent");
      }
      if (!rent_start_date || !rent_end_date) {
        throw new BadRequestException("Rent start and end dates are required for rental");
      }

      const startDate = new Date(rent_start_date);
      const endDate = new Date(rent_end_date);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      if (days < plant.minRentDays) {
        throw new BadRequestException(`Minimum rental period is ${plant.minRentDays} days`);
      }
      if (days > plant.maxRentDays) {
        throw new BadRequestException(`Maximum rental period is ${plant.maxRentDays} days`);
      }

      // Check availability
      const availability = await this.checkPlantAvailability(plant_id, startDate, endDate, quantity);
      if (!availability.available) {
        throw new BadRequestException(`Only ${availability.available_quantity} plants available for this period`);
      }
    } else if (order_type === OrderType.BUY) {
      if (!plant.isAvailableForSale) {
        throw new BadRequestException("Plant is not available for sale");
      }
      if (plant.stockQuantity < quantity) {
        throw new BadRequestException(`Only ${plant.stockQuantity} plants available`);
      }
    }

    const cart = await this.getOrCreateCart(userId);

    // Check if same plant+order_type already exists
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_plantId_orderType: {
          cartId: cart.id,
          plantId: plant_id,
          orderType: order_type,
        },
      },
    });

    if (existingItem) {
      // Update quantity
      const updated = await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + quantity,
          rentStartDate: rent_start_date ? new Date(rent_start_date) : existingItem.rentStartDate,
          rentEndDate: rent_end_date ? new Date(rent_end_date) : existingItem.rentEndDate,
        },
      });

      return this.getCart(userId);
    }

    // Create new item
    await this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        plantId: plant_id,
        quantity,
        orderType: order_type,
        rentStartDate: rent_start_date ? new Date(rent_start_date) : null,
        rentEndDate: rent_end_date ? new Date(rent_end_date) : null,
      },
    });

    return this.getCart(userId);
  }

  // PUT /api/v1/cart/items/{item_id}
  async updateItem(userId: string, itemId: string, updateDto: any) {
    const cart = await this.getOrCreateCart(userId);

    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
      include: {
        plant: true,
      },
    });

    if (!item) {
      throw new NotFoundException("Cart item not found");
    }

    const { quantity, rent_start_date, rent_end_date } = updateDto;

    // Validate if updating rental dates
    if (item.orderType === OrderType.RENT && (rent_start_date || rent_end_date)) {
      const startDate = rent_start_date ? new Date(rent_start_date) : item.rentStartDate;
      const endDate = rent_end_date ? new Date(rent_end_date) : item.rentEndDate;

      if (startDate && endDate) {
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        if (days < item.plant.minRentDays) {
          throw new BadRequestException(`Minimum rental period is ${item.plant.minRentDays} days`);
        }
        if (days > item.plant.maxRentDays) {
          throw new BadRequestException(`Maximum rental period is ${item.plant.maxRentDays} days`);
        }

        // Check availability
        const availability = await this.checkPlantAvailability(
          item.plantId,
          startDate,
          endDate,
          quantity || item.quantity
        );
        if (!availability.available) {
          throw new BadRequestException(`Only ${availability.available_quantity} plants available for this period`);
        }
      }
    }

    // Validate quantity
    if (quantity !== undefined) {
      if (item.orderType === OrderType.BUY && item.plant.stockQuantity < quantity) {
        throw new BadRequestException(`Only ${item.plant.stockQuantity} plants available`);
      }
    }

    const updated = await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        ...(quantity !== undefined && { quantity }),
        ...(rent_start_date && { rentStartDate: new Date(rent_start_date) }),
        ...(rent_end_date && { rentEndDate: new Date(rent_end_date) }),
      },
    });

    return this.getCart(userId);
  }

  // DELETE /api/v1/cart/items/{item_id}
  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreateCart(userId);

    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
    });

    if (!item) {
      throw new NotFoundException("Cart item not found");
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    return this.getCart(userId);
  }

  // DELETE /api/v1/cart
  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await this.prisma.cartPackageItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.getCart(userId);
  }

  // POST /api/v1/cart/validate
  async validateCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    const issues: any[] = [];

    // Validate plant items
    for (const item of cart.items) {
      const plant = await this.prisma.plant.findUnique({
        where: { id: item.plantId },
      });

      if (!plant || !plant.isActive) {
        issues.push({
          item_id: item.id,
          issue: "OUT_OF_STOCK",
          details: "Plant is no longer available",
        });
        continue;
      }

      // Check stock
      if (item.orderType === OrderType.BUY && plant.stockQuantity < item.quantity) {
        issues.push({
          item_id: item.id,
          issue: "OUT_OF_STOCK",
          details: `Only ${plant.stockQuantity} available`,
        });
      }

      // Check rental availability
      if (item.orderType === OrderType.RENT && item.rentStartDate && item.rentEndDate) {
        const availability = await this.checkPlantAvailability(
          item.plantId,
          item.rentStartDate,
          item.rentEndDate,
          item.quantity
        );
        if (!availability.available) {
          issues.push({
            item_id: item.id,
            issue: "OUT_OF_STOCK",
            details: `Only ${availability.available_quantity} available for this period`,
          });
        }
      }

      // Check price changes (simplified - would need to store original price)
      // This is a placeholder
    }

    // Validate package items
    for (const pkgItem of cart.packageItems) {
      if (pkgItem.package) {
        const packageData = await this.prisma.plantPackage.findUnique({
          where: { id: pkgItem.packageId! },
        });

        if (!packageData || !packageData.isActive) {
          issues.push({
            item_id: pkgItem.id,
            issue: "OUT_OF_STOCK",
            details: "Package is no longer available",
          });
        }
      } else if (pkgItem.customPackageId) {
        const customPackage = await this.prisma.customPlantPackage.findUnique({
          where: { id: pkgItem.customPackageId },
        });

        if (!customPackage) {
          issues.push({
            item_id: pkgItem.id,
            issue: "OUT_OF_STOCK",
            details: "Custom package no longer exists",
          });
        }
      }
    }

    // Check serviceability (would need user's default address)
    // This is a placeholder

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  // POST /api/v1/cart/apply-coupon
  async applyCoupon(userId: string, couponDto: any) {
    const { coupon_code } = couponDto;

    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code: coupon_code,
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() },
      },
    });

    if (!coupon) {
      throw new NotFoundException("Invalid or expired coupon");
    }

    const cart = await this.getOrCreateCart(userId);
    const summary = this.calculateCartSummary(cart);

    // Check min order amount
    if (summary.subtotal < Number(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `Minimum order amount of ${coupon.minOrderAmount} required`
      );
    }

    // Check usage limits
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException("Coupon usage limit reached");
    }

    // Check per user limit
    const userUsage = await this.prisma.couponUsage.count({
      where: {
        couponId: coupon.id,
        userId,
      },
    });

    if (userUsage >= coupon.perUserLimit) {
      throw new BadRequestException("You have reached the usage limit for this coupon");
    }

    // Calculate discount
    let discount = new Decimal(0);
    if (coupon.discountType === "PERCENTAGE") {
      discount = new Decimal(summary.subtotal).times(coupon.discountValue).dividedBy(100);
      if (coupon.maxDiscountAmount) {
        discount = Decimal.min(discount, coupon.maxDiscountAmount);
      }
    } else {
      discount = coupon.discountValue;
    }

    // Store coupon in cart (would need to add couponId to Cart model or use session)
    // For now, return the discount info
    return {
      ...this.getCart(userId),
      applied_coupon: {
        code: coupon.code,
        discount: Number(discount),
        discount_type: coupon.discountType,
      },
    };
  }

  // DELETE /api/v1/cart/coupon
  async removeCoupon(userId: string) {
    // Remove applied coupon (would need to store in cart or session)
    return this.getCart(userId);
  }

  // POST /api/v1/cart/packages - Add package to cart
  async addPackage(userId: string, addPackageDto: any) {
    const { package_id, custom_package_id, quantity = 1 } = addPackageDto;

    if (!package_id && !custom_package_id) {
      throw new BadRequestException("Either package_id or custom_package_id is required");
    }

    const cart = await this.getOrCreateCart(userId);

    if (package_id) {
      const packageData = await this.prisma.plantPackage.findFirst({
        where: {
          id: package_id,
          isActive: true,
        },
      });

      if (!packageData) {
        throw new NotFoundException("Package not found");
      }

      // Check if already in cart
      const existing = await this.prisma.cartPackageItem.findFirst({
        where: {
          cartId: cart.id,
          packageId: package_id,
        },
      });

      if (existing) {
        await this.prisma.cartPackageItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + quantity },
        });
      } else {
        await this.prisma.cartPackageItem.create({
          data: {
            cartId: cart.id,
            packageId: package_id,
            quantity,
          },
        });
      }
    } else if (custom_package_id) {
      const customPackage = await this.prisma.customPlantPackage.findFirst({
        where: {
          id: custom_package_id,
          userId,
        },
      });

      if (!customPackage) {
        throw new NotFoundException("Custom package not found");
      }

      // Check if already in cart
      const existing = await this.prisma.cartPackageItem.findFirst({
        where: {
          cartId: cart.id,
          customPackageId: custom_package_id,
        },
      });

      if (existing) {
        await this.prisma.cartPackageItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + quantity },
        });
      } else {
        await this.prisma.cartPackageItem.create({
          data: {
            cartId: cart.id,
            customPackageId: custom_package_id,
            quantity,
          },
        });
      }
    }

    return this.getCart(userId);
  }

  // DELETE /api/v1/cart/packages/:item_id
  async removePackage(userId: string, itemId: string) {
    const cart = await this.getOrCreateCart(userId);

    const item = await this.prisma.cartPackageItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
    });

    if (!item) {
      throw new NotFoundException("Package item not found");
    }

    await this.prisma.cartPackageItem.delete({
      where: { id: itemId },
    });

    return this.getCart(userId);
  }

  // Helper: Check plant availability
  private async checkPlantAvailability(
    plantId: string,
    startDate: Date,
    endDate: Date,
    quantity: number
  ) {
    const plant = await this.prisma.plant.findUnique({
      where: { id: plantId },
    });

    if (!plant || !plant.isActive) {
      return { available: false, available_quantity: 0 };
    }

    // Check active rentals in this period
    const activeRentals = await this.prisma.orderItem.count({
      where: {
        plantId: plantId,
        orderType: OrderType.RENT,
        rentalStatus: {
          in: ["ACTIVE", "EXTENDED"],
        },
        OR: [
          {
            AND: [
              { rentStartDate: { lte: startDate } },
              { rentEndDate: { gte: startDate } },
            ],
          },
          {
            AND: [
              { rentStartDate: { lte: endDate } },
              { rentEndDate: { gte: endDate } },
            ],
          },
          {
            AND: [
              { rentStartDate: { gte: startDate } },
              { rentEndDate: { lte: endDate } },
            ],
          },
        ],
      },
    });

    const availableQuantity = Math.max(0, plant.stockQuantity - activeRentals);

    return {
      available: availableQuantity >= quantity,
      available_quantity: availableQuantity,
    };
  }
}
