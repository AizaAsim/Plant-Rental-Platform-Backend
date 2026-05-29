import { BadRequestException, Injectable } from "@nestjs/common";
import { OrderType, Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

export type InventoryLine = { plantId: string; quantity: number; orderType?: OrderType };

export type PlantStockSnapshot = {
  plant_id: string;
  available: number;
  reserved: number;
  delivered: number;
  total: number;
};

@Injectable()
export class PlantInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  snapshot(plant: {
    id: string;
    stockQuantity: number;
    reservedQuantity: number;
    deliveredQuantity: number;
  }): PlantStockSnapshot {
    return {
      plant_id: plant.id,
      available: plant.stockQuantity,
      reserved: plant.reservedQuantity,
      delivered: plant.deliveredQuantity,
      total: plant.stockQuantity + plant.reservedQuantity + plant.deliveredQuantity,
    };
  }

  /** Aggregate lines by plantId (sums quantities). */
  aggregateLines(lines: InventoryLine[]): InventoryLine[] {
    const map = new Map<string, { quantity: number; orderType?: OrderType }>();
    for (const line of lines) {
      const pid = String(line.plantId).trim();
      const qty = Math.max(0, Number(line.quantity) || 0);
      if (!pid || qty <= 0) continue;
      const prev = map.get(pid);
      map.set(pid, {
        quantity: (prev?.quantity ?? 0) + qty,
        orderType: line.orderType ?? prev?.orderType,
      });
    }
    return [...map.entries()].map(([plantId, v]) => ({
      plantId,
      quantity: v.quantity,
      orderType: v.orderType,
    }));
  }

  async assertCanReserve(
    tx: Prisma.TransactionClient,
    lines: InventoryLine[],
    label = "Insufficient available stock"
  ) {
    for (const line of this.aggregateLines(lines)) {
      const plant = await tx.plant.findUnique({
        where: { id: line.plantId },
        select: { id: true, name: true, stockQuantity: true, isActive: true },
      });
      if (!plant || !plant.isActive) {
        throw new BadRequestException(`Plant ${line.plantId} is not available`);
      }
      if (plant.stockQuantity < line.quantity) {
        throw new BadRequestException(
          `${label} for ${plant.name}: need ${line.quantity}, available ${plant.stockQuantity}`
        );
      }
    }
  }

  /** AVAILABLE → RESERVED (checkout / pending booking). */
  async reserve(tx: Prisma.TransactionClient, lines: InventoryLine[]) {
    for (const line of this.aggregateLines(lines)) {
      const updated = await tx.plant.updateMany({
        where: {
          id: line.plantId,
          stockQuantity: { gte: line.quantity },
        },
        data: {
          stockQuantity: { decrement: line.quantity },
          reservedQuantity: { increment: line.quantity },
        },
      });
      if (updated.count === 0) {
        throw new BadRequestException(`Could not reserve ${line.quantity} for plant ${line.plantId}`);
      }
    }
  }

  /** RESERVED → AVAILABLE (cancel / reject / expire before delivery). */
  async releaseReserved(tx: Prisma.TransactionClient, lines: InventoryLine[]) {
    for (const line of this.aggregateLines(lines)) {
      const updated = await tx.plant.updateMany({
        where: {
          id: line.plantId,
          reservedQuantity: { gte: line.quantity },
        },
        data: {
          stockQuantity: { increment: line.quantity },
          reservedQuantity: { decrement: line.quantity },
        },
      });
      if (updated.count === 0) {
        throw new BadRequestException(`Could not release reserved stock for plant ${line.plantId}`);
      }
    }
  }

  /** RESERVED → DELIVERED (delivery complete — rental lines). */
  async deliverReserved(tx: Prisma.TransactionClient, lines: InventoryLine[]) {
    for (const line of this.aggregateLines(lines)) {
      const updated = await tx.plant.updateMany({
        where: {
          id: line.plantId,
          reservedQuantity: { gte: line.quantity },
        },
        data: {
          reservedQuantity: { decrement: line.quantity },
          deliveredQuantity: { increment: line.quantity },
        },
      });
      if (updated.count === 0) {
        throw new BadRequestException(`Could not deliver reserved stock for plant ${line.plantId}`);
      }
    }
  }

  /** RESERVED → sold (BUY lines — leaves inventory permanently). */
  async finalizeBuyFromReserved(tx: Prisma.TransactionClient, lines: InventoryLine[]) {
    for (const line of this.aggregateLines(lines)) {
      const updated = await tx.plant.updateMany({
        where: {
          id: line.plantId,
          reservedQuantity: { gte: line.quantity },
        },
        data: {
          reservedQuantity: { decrement: line.quantity },
        },
      });
      if (updated.count === 0) {
        throw new BadRequestException(`Could not finalize purchase stock for plant ${line.plantId}`);
      }
    }
  }

  /** DELIVERED → AVAILABLE (return complete). */
  async returnDeliveredToAvailable(tx: Prisma.TransactionClient, lines: InventoryLine[]) {
    for (const line of this.aggregateLines(lines)) {
      const updated = await tx.plant.updateMany({
        where: {
          id: line.plantId,
          deliveredQuantity: { gte: line.quantity },
        },
        data: {
          deliveredQuantity: { decrement: line.quantity },
          stockQuantity: { increment: line.quantity },
        },
      });
      if (updated.count === 0) {
        throw new BadRequestException(`Could not restore returned stock for plant ${line.plantId}`);
      }
    }
  }

  /** Legacy: restore stock that was decremented from available at vendor approve (no reserved counter). */
  async legacyRestoreAvailable(tx: Prisma.TransactionClient, lines: InventoryLine[]) {
    for (const line of this.aggregateLines(lines)) {
      await tx.plant.update({
        where: { id: line.plantId },
        data: { stockQuantity: { increment: line.quantity } },
      });
    }
  }

  linesFromOrderItems(
    items: { plantId: string; quantity: number; orderType: OrderType }[]
  ): InventoryLine[] {
    return items.map((i) => ({
      plantId: i.plantId,
      quantity: i.quantity,
      orderType: i.orderType,
    }));
  }

  rentLines(items: { plantId: string; quantity: number; orderType: OrderType }[]): InventoryLine[] {
    return this.linesFromOrderItems(items.filter((i) => i.orderType === OrderType.RENT));
  }

  buyLines(items: { plantId: string; quantity: number; orderType: OrderType }[]): InventoryLine[] {
    return this.linesFromOrderItems(items.filter((i) => i.orderType === OrderType.BUY));
  }

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
      ...(search
        ? { name: { contains: search, mode: "insensitive" } }
        : {}),
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
        reserved_stock: p.reservedQuantity,
        delivered_stock: p.deliveredQuantity,
        total_stock: p.stockQuantity + p.reservedQuantity + p.deliveredQuantity,
        rent_price_monthly: p.rentPriceMonthly ? Number(p.rentPriceMonthly) : null,
        buy_price: p.buyPrice ? Number(p.buyPrice) : null,
        is_low_stock: p.stockQuantity > 0 && p.stockQuantity <= 5,
        is_out_of_stock: p.stockQuantity === 0,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  /** Plants with available stock > 0 for package picker dropdown. */
  async listPickerPlants(vendorId: string, search?: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) return [];

    const plants = await this.prisma.plant.findMany({
      where: {
        nurseryId: nursery.id,
        isActive: true,
        stockQuantity: { gt: 0 },
        ...(search?.trim()
          ? { name: { contains: search.trim(), mode: "insensitive" } }
          : {}),
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
