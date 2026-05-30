import { Injectable } from "@nestjs/common";
import { OrderStatus, RentalStatus, TaskStatus } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class ActiveMaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, query?: { page?: number; limit?: number }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          userId,
          orderType: "RENT",
          status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
        },
        rentalStatus: { in: [RentalStatus.ACTIVE, RentalStatus.EXTENDED] },
        OR: [
          { order: { vendorPackage: { includesMaintenance: true } } },
          { maintenanceTasks: { some: {} } },
        ],
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            vendorPackage: { select: { name: true, maintenanceVisitsPerMonth: true } },
            nursery: { select: { id: true, name: true } },
          },
        },
        plant: {
          select: { id: true, name: true },
        },
        maintenanceTasks: {
          where: {
            status: {
              in: [
                TaskStatus.PENDING,
                TaskStatus.ASSIGNED,
                TaskStatus.ACCEPTED,
                TaskStatus.IN_PROGRESS,
              ],
            },
          },
          orderBy: [{ scheduledDate: "asc" }],
          take: 1,
          include: {
            gardener: {
              include: {
                user: { select: { id: true, fullName: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const total = await this.prisma.orderItem.count({
      where: {
        order: {
          userId,
          orderType: "RENT",
          status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
        },
        rentalStatus: { in: [RentalStatus.ACTIVE, RentalStatus.EXTENDED] },
        OR: [
          { order: { vendorPackage: { includesMaintenance: true } } },
          { maintenanceTasks: { some: {} } },
        ],
      },
    });

    const rentals = items.map((line) => {
      const nextTask = line.maintenanceTasks[0];
      const gardener = nextTask?.gardener;
      return {
        rental_id: line.id,
        order_id: line.order.id,
        order_number: line.order.orderNumber,
        package_name: line.order.vendorPackage?.name ?? null,
        plant_name: line.plant.name,
        nursery_name: line.order.nursery.name,
        gardener: gardener
          ? {
              gardener_id: gardener.id,
              name: gardener.user.fullName,
            }
          : null,
        next_visit: nextTask?.scheduledDate
          ? nextTask.scheduledDate.toISOString().slice(0, 10)
          : null,
        maintenance_schedule:
          line.order.vendorPackage?.maintenanceVisitsPerMonth != null &&
          line.order.vendorPackage.maintenanceVisitsPerMonth > 0
            ? `${line.order.vendorPackage.maintenanceVisitsPerMonth}x_MONTHLY`
            : null,
        service_status: line.rentalStatus,
        maintenance_notes: nextTask?.description ?? null,
        rental_duration: {
          start: line.rentStartDate?.toISOString().slice(0, 10) ?? null,
          end: line.rentEndDate?.toISOString().slice(0, 10) ?? null,
        },
      };
    });

    return {
      rentals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }
}
