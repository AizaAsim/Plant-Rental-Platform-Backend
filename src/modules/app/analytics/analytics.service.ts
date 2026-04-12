import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole, PaymentStatus } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private periodStart(period?: string) {
    const now = new Date();
    const d = new Date(now);
    if (period === "day") d.setDate(d.getDate() - 1);
    else if (period === "week") d.setDate(d.getDate() - 7);
    else if (period === "year") d.setFullYear(d.getFullYear() - 1);
    else d.setMonth(d.getMonth() - 1);
    return d;
  }

  private prevPeriodStart(period?: string) {
    const a = this.periodStart(period);
    const len = new Date().getTime() - a.getTime();
    return new Date(a.getTime() - len);
  }

  async adminOverview(period?: string) {
    const from = this.periodStart(period);
    const prevFrom = this.prevPeriodStart(period);

    const [totalUsers, totalVendors, totalGardeners, totalOrders, ordersAgg, commissionSum, activeRentals] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { role: UserRole.VENDOR } }),
        this.prisma.user.count({ where: { role: UserRole.GARDENER } }),
        this.prisma.order.count({ where: { createdAt: { gte: from } } }),
        this.prisma.order.aggregate({
          where: { createdAt: { gte: from }, paymentStatus: PaymentStatus.PAID },
          _sum: { totalAmount: true },
        }),
        this.prisma.vendorEarning.aggregate({
          where: { createdAt: { gte: from } },
          _sum: { commissionAmount: true },
        }),
        this.prisma.orderItem.count({
          where: { rentalStatus: { in: ["ACTIVE", "EXTENDED"] } },
        }),
      ]);

    const [usersPrev, ordersPrev, revPrev] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: prevFrom, lt: from } } }),
      this.prisma.order.count({ where: { createdAt: { gte: prevFrom, lt: from } } }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: prevFrom, lt: from }, paymentStatus: PaymentStatus.PAID },
        _sum: { totalAmount: true },
      }),
    ]);

    const revenue = ordersAgg._sum.totalAmount?.toNumber() ?? 0;
    const revenuePrev = revPrev._sum.totalAmount?.toNumber() ?? 0;
    const pct = (cur: number, old: number) =>
      old === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - old) / old) * 10000) / 100;

    return {
      total_users: totalUsers,
      total_vendors: totalVendors,
      total_gardeners: totalGardeners,
      total_orders: totalOrders,
      total_revenue: revenue,
      total_commission: commissionSum._sum.commissionAmount?.toNumber() ?? 0,
      active_rentals: activeRentals,
      period_comparison: {
        users_change: pct(
          await this.prisma.user.count({ where: { createdAt: { gte: from } } }),
          usersPrev
        ),
        orders_change: pct(totalOrders, ordersPrev),
        revenue_change: pct(revenue, revenuePrev),
      },
      period: period || "month",
    };
  }

  async adminRevenue(period?: string, group_by?: string) {
    const from = this.periodStart(period);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: from }, paymentStatus: PaymentStatus.PAID },
      select: { createdAt: true, totalAmount: true },
    });
    const buckets = new Map<string, number>();
    for (const o of orders) {
      const d = o.createdAt;
      let key: string;
      if (group_by === "day") key = d.toISOString().slice(0, 10);
      else if (group_by === "year") key = d.getFullYear().toString();
      else key = `${d.getFullYear()}-W${Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)}`;
      buckets.set(key, (buckets.get(key) || 0) + o.totalAmount.toNumber());
    }
    return { series: [...buckets.entries()].map(([period, amount]) => ({ period, amount })) };
  }

  async adminOrdersAnalytics(period?: string, group_by?: string, order_type?: string) {
    const from = this.periodStart(period);
    const where: Prisma.OrderWhereInput = {
      createdAt: { gte: from },
      ...(order_type && { orderType: order_type as any }),
    };
    const [byStatus, total] = await Promise.all([
      this.prisma.order.groupBy({
        by: ["status"],
        where,
        _count: true,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { total, by_status: byStatus, group_by: group_by || "week" };
  }

  async topNurseries(period?: string, limit = 10, metric?: string) {
    const from = this.periodStart(period);
    const take = Math.min(Number(limit) || 10, 50);
    if (metric === "rating") {
      return this.prisma.nursery.findMany({
        take,
        orderBy: { ratingAvg: "desc" },
        select: { id: true, name: true, ratingAvg: true, totalReviews: true, city: true },
      });
    }
    const rows = await this.prisma.order.groupBy({
      by: ["nurseryId"],
      where: { createdAt: { gte: from } },
      _count: true,
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take,
    });
    const nurseries = await this.prisma.nursery.findMany({
      where: { id: { in: rows.map((r) => r.nurseryId) } },
      select: { id: true, name: true, city: true },
    });
    const map = new Map(nurseries.map((n) => [n.id, n]));
    return rows.map((r) => ({
      nursery: map.get(r.nurseryId),
      orders: r._count,
      revenue: r._sum.totalAmount?.toNumber() ?? 0,
    }));
  }

  async topPlants(period?: string, limit = 10, metric?: string) {
    const take = Math.min(Number(limit) || 10, 50);
    const from = this.periodStart(period);
    if (metric === "views") {
      const ints = await this.prisma.userPlantInteraction.groupBy({
        by: ["plantId"],
        where: { createdAt: { gte: from }, interactionType: "VIEW" },
        _count: true,
        orderBy: { _count: { plantId: "desc" } },
        take,
      });
      const plants = await this.prisma.plant.findMany({
        where: { id: { in: ints.map((i) => i.plantId) } },
        select: { id: true, name: true, nurseryId: true },
      });
      const pm = new Map(plants.map((p) => [p.id, p]));
      return ints.map((i) => ({ plant: pm.get(i.plantId), views: i._count }));
    }
    const items = await this.prisma.orderItem.groupBy({
      by: ["plantId"],
      where: { order: { createdAt: { gte: from } } },
      _count: true,
      _sum: { totalPrice: true },
      orderBy: { _sum: { totalPrice: "desc" } },
      take,
    });
    const plants = await this.prisma.plant.findMany({
      where: { id: { in: items.map((i) => i.plantId) } },
      select: { id: true, name: true },
    });
    const pm = new Map(plants.map((p) => [p.id, p]));
    return items.map((i) => ({
      plant: pm.get(i.plantId),
      rentals_or_lines: i._count,
      revenue: i._sum.totalPrice?.toNumber() ?? 0,
    }));
  }

  async userGrowth(period?: string, group_by?: string, role?: UserRole) {
    const from = this.periodStart(period);
    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: from }, ...(role && { role }) },
      select: { createdAt: true },
    });
    const buckets = new Map<string, number>();
    for (const u of users) {
      const d = u.createdAt;
      const key =
        group_by === "day"
          ? d.toISOString().slice(0, 10)
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    return { series: [...buckets.entries()].map(([period, registrations]) => ({ period, registrations })) };
  }

  // --- Vendor ---
  async vendorOverview(vendorUserId: string, period?: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId: vendorUserId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    const from = this.periodStart(period);
    const [orders, revenue, plants] = await Promise.all([
      this.prisma.order.count({ where: { nurseryId: nursery.id, createdAt: { gte: from } } }),
      this.prisma.order.aggregate({
        where: { nurseryId: nursery.id, createdAt: { gte: from } },
        _sum: { totalAmount: true },
      }),
      this.prisma.plant.count({ where: { nurseryId: nursery.id } }),
    ]);
    return {
      nursery_id: nursery.id,
      orders_in_period: orders,
      revenue: revenue._sum.totalAmount?.toNumber() ?? 0,
      total_plants: plants,
      rating_avg: nursery.ratingAvg.toNumber(),
      period: period || "month",
    };
  }

  async vendorSales(vendorUserId: string, period?: string, group_by?: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId: vendorUserId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    const from = this.periodStart(period);
    const orders = await this.prisma.order.findMany({
      where: { nurseryId: nursery.id, createdAt: { gte: from } },
      select: { createdAt: true, totalAmount: true },
    });
    const buckets = new Map<string, number>();
    for (const o of orders) {
      const d = o.createdAt;
      const key = group_by === "day" ? d.toISOString().slice(0, 10) : `${d.getFullYear()}-${d.getMonth() + 1}`;
      buckets.set(key, (buckets.get(key) || 0) + o.totalAmount.toNumber());
    }
    return { series: [...buckets.entries()].map(([period, amount]) => ({ period, amount })) };
  }

  async vendorInventory(vendorUserId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId: vendorUserId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    const plants = await this.prisma.plant.findMany({
      where: { nurseryId: nursery.id },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        isActive: true,
        totalRentals: true,
        totalReviews: true,
      },
    });
    const low = plants.filter((p) => p.isActive && p.stockQuantity > 0 && p.stockQuantity <= 3);
    const out = plants.filter((p) => p.isActive && p.stockQuantity === 0);
    const topRented = [...plants].sort((a, b) => b.totalRentals - a.totalRentals).slice(0, 5);
    return {
      total_plants: plants.length,
      active_plants: plants.filter((p) => p.isActive).length,
      low_stock_plants: low,
      out_of_stock_plants: out,
      top_rented: topRented,
      top_sold: topRented,
    };
  }

  async vendorRentals(vendorUserId: string, period?: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId: vendorUserId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    const from = this.periodStart(period);
    const items = await this.prisma.orderItem.findMany({
      where: {
        orderType: "RENT",
        order: { nurseryId: nursery.id, createdAt: { gte: from } },
      },
      select: { id: true, rentalStatus: true, rentStartDate: true, rentEndDate: true },
    });
    const byStatus = items.reduce(
      (acc, i) => {
        acc[i.rentalStatus || "UNKNOWN"] = (acc[i.rentalStatus || "UNKNOWN"] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    return { total_lines: items.length, by_status: byStatus, period: period || "month" };
  }
}
