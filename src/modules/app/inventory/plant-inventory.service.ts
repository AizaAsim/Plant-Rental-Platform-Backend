import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class PlantInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listVendorInventory(vendorId: string, query?: { search?: string; page?: number; limit?: number }) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) return { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };

    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;
    const search = query?.search?.trim();

    const where: Prisma.PlantWhereInput = {
      nurseryId: nursery.id,
      isActive: true,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };

    const [plants, total] = await Promise.all([
      this.prisma.plant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          category: { select: { name: true } },
        },
      }),
      this.prisma.plant.count({ where }),
    ]);

    return {
      items: plants.map((p) => ({
        plant_id: p.id,
        plant_name: p.name,
        category: p.category?.name ?? null,
        image_url: p.images[0]?.imageUrl ?? null,
        available_stock: p.stockQuantity,
        stock_status: p.stockQuantity === 0 ? "OUT_OF_STOCK" : "AVAILABLE",
        is_low_stock: p.stockQuantity > 0 && p.stockQuantity <= 5,
        is_out_of_stock: p.stockQuantity === 0,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async listPickerPlants(vendorId: string, search?: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) return [];

    const plants = await this.prisma.plant.findMany({
      where: {
        nurseryId: nursery.id,
        isActive: true,
        stockQuantity: { gt: 0 },
        ...(search?.trim() ? { name: { contains: search.trim(), mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
      take: 50,
      include: { images: { where: { isPrimary: true }, take: 1 } },
    });

    return plants.map((p) => ({
      plant_id: p.id,
      plant_name: p.name,
      image_url: p.images[0]?.imageUrl ?? null,
      available_stock: p.stockQuantity,
    }));
  }
}
