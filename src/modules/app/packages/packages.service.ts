// src/modules/app/packages/packages.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

@Injectable()
export class PackagesService {
  constructor(private prisma: PrismaService) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private async ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.plantPackage.findFirst({
        where: {
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  // GET /api/v1/packages - Get all fixed packages
  async getAllPackages() {
    const packages = await this.prisma.plantPackage.findMany({
      where: {
        isActive: true,
        isDefault: true, // Only fixed packages created by admin
      },
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
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return packages;
  }

  // GET /api/v1/packages/:package_id - Get package details
  async getPackageById(packageId: string) {
    const packageData = await this.prisma.plantPackage.findUnique({
      where: { id: packageId },
      include: {
        items: {
          include: {
            plant: {
              include: {
                images: {
                  orderBy: { displayOrder: "asc" },
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
      },
    });

    if (!packageData || !packageData.isActive) {
      throw new NotFoundException("Package not found");
    }

    return packageData;
  }

  // POST /api/v1/packages/custom - Create custom package
  async createCustomPackage(userId: string, createDto: any) {
    const {
      base_package_id,
      name,
      items, // Array of { plant_id, quantity }
    } = createDto;

    // Verify user is corporate
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isCorporate) {
      throw new ForbiddenException("Only corporate users can create custom packages");
    }

    let basePackage = null;
    if (base_package_id) {
      basePackage = await this.prisma.plantPackage.findUnique({
        where: { id: base_package_id },
        include: {
          items: true,
        },
      });

      if (!basePackage) {
        throw new NotFoundException("Base package not found");
      }
    }

    // Validate all plants exist and are active
    const plantIds = items.map((item: any) => item.plant_id);
    const plants = await this.prisma.plant.findMany({
      where: {
        id: { in: plantIds },
        isActive: true,
        stockQuantity: { gt: 0 },
      },
    });

    if (plants.length !== plantIds.length) {
      throw new BadRequestException("Some plants not found or unavailable");
    }

    // Calculate total price
    let totalPrice = new Decimal(0);
    for (const item of items) {
      const plant = plants.find((p) => p.id === item.plant_id);
      if (!plant) continue;

      const itemPrice = plant.buyPrice || plant.rentPriceMonthly || new Decimal(0);
      totalPrice = totalPrice.plus(itemPrice.times(item.quantity || 1));
    }

    // Apply discount if based on package
    if (basePackage) {
      const basePrice = basePackage.price;
      const discount = basePrice.minus(totalPrice);
      if (discount.gt(0)) {
        // Apply some discount based on base package
        totalPrice = totalPrice.minus(discount.times(0.1)); // 10% of base discount
      }
    }

    // Create custom package
    const customPackage = await this.prisma.customPlantPackage.create({
      data: {
        userId,
        basePackageId: base_package_id,
        name: name || `Custom Package - ${new Date().toLocaleDateString()}`,
        price: totalPrice,
        items: {
          create: items.map((item: any) => ({
            plantId: item.plant_id,
            quantity: item.quantity || 1,
          })),
        },
      },
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
        basePackage: true,
      },
    });

    return customPackage;
  }

  // GET /api/v1/packages/custom - Get user's custom packages
  async getUserCustomPackages(userId: string) {
    const packages = await this.prisma.customPlantPackage.findMany({
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
              },
            },
          },
        },
        basePackage: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return packages;
  }

  // GET /api/v1/packages/custom/:package_id - Get custom package details
  async getCustomPackageById(userId: string, packageId: string) {
    const packageData = await this.prisma.customPlantPackage.findFirst({
      where: {
        id: packageId,
        userId,
      },
      include: {
        items: {
          include: {
            plant: {
              include: {
                images: {
                  orderBy: { displayOrder: "asc" },
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
        basePackage: true,
      },
    });

    if (!packageData) {
      throw new NotFoundException("Custom package not found");
    }

    return packageData;
  }

  // PUT /api/v1/packages/custom/:package_id - Update custom package
  async updateCustomPackage(userId: string, packageId: string, updateDto: any) {
    const packageData = await this.prisma.customPlantPackage.findFirst({
      where: {
        id: packageId,
        userId,
      },
    });

    if (!packageData) {
      throw new NotFoundException("Custom package not found");
    }

    const { name, items } = updateDto;

    // If items are being updated, recalculate price
    if (items && Array.isArray(items)) {
      const plantIds = items.map((item: any) => item.plant_id);
      const plants = await this.prisma.plant.findMany({
        where: {
          id: { in: plantIds },
          isActive: true,
        },
      });

      let totalPrice = new Decimal(0);
      for (const item of items) {
        const plant = plants.find((p) => p.id === item.plant_id);
        if (!plant) continue;

        const itemPrice = plant.buyPrice || plant.rentPriceMonthly || new Decimal(0);
        totalPrice = totalPrice.plus(itemPrice.times(item.quantity || 1));
      }

      // Delete old items
      await this.prisma.customPlantPackageItem.deleteMany({
        where: { customPackageId: packageId },
      });

      // Create new items
      await this.prisma.customPlantPackageItem.createMany({
        data: items.map((item: any) => ({
          customPackageId: packageId,
          plantId: item.plant_id,
          quantity: item.quantity || 1,
        })),
      });

      // Update package
      const updated = await this.prisma.customPlantPackage.update({
        where: { id: packageId },
        data: {
          name: name || packageData.name,
          price: totalPrice,
        },
        include: {
          items: {
            include: {
              plant: true,
            },
          },
        },
      });

      return updated;
    }

    // Just update name
    const updated = await this.prisma.customPlantPackage.update({
      where: { id: packageId },
      data: {
        name: name || packageData.name,
      },
      include: {
        items: {
          include: {
            plant: true,
          },
        },
      },
    });

    return updated;
  }

  // DELETE /api/v1/packages/custom/:package_id - Delete custom package
  async deleteCustomPackage(userId: string, packageId: string) {
    const packageData = await this.prisma.customPlantPackage.findFirst({
      where: {
        id: packageId,
        userId,
      },
    });

    if (!packageData) {
      throw new NotFoundException("Custom package not found");
    }

    await this.prisma.customPlantPackage.delete({
      where: { id: packageId },
    });

    return { message: "Custom package deleted successfully" };
  }
}
