import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import {
  OrderStatus,
  OrderType,
  RentalStatus,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "src/prisma/prisma.service";

export type ExtensionInput = {
  new_end_date?: string;
  additional_weeks?: number;
  reason?: string;
};

export type ValidatedExtension = {
  newEndDate: Date;
  originalEndDate: Date;
  extensionPrice: Decimal;
  additionalWeeks?: number;
  reason?: string;
};

const EXTENDABLE_RENTAL_STATUSES: RentalStatus[] = [
  RentalStatus.ACTIVE,
  RentalStatus.EXTENDED,
  RentalStatus.OVERDUE,
];

const EXTENDABLE_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
]);

@Injectable()
export class RentalExtensionPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  private extensionWindowDays(): number {
    const n = Number(process.env.RENTAL_EXTENSION_WINDOW_DAYS ?? 7);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 7;
  }

  assertCustomerOrderAllowsRentalMutation(
    order: { status: OrderStatus },
    actionLabel: string
  ): void {
    const blocked = new Set<OrderStatus>([
      OrderStatus.CANCELLED,
      OrderStatus.EXPIRED,
    ]);
    if (blocked.has(order.status)) {
      throw new BadRequestException(
        `${actionLabel} is not allowed when order status is ${order.status}`
      );
    }
  }

  resolveNewEndDate(
    originalEndDate: Date,
    input: ExtensionInput
  ): { newEndDate: Date; additionalWeeks?: number } {
    if (input.new_end_date != null && String(input.new_end_date).trim() !== "") {
      const newEndDate = new Date(String(input.new_end_date));
      if (Number.isNaN(newEndDate.getTime())) {
        throw new BadRequestException("Invalid new_end_date");
      }
      return { newEndDate };
    }

    const weeks = Number(input.additional_weeks);
    if (!Number.isFinite(weeks) || weeks < 1) {
      throw new BadRequestException(
        "Either new_end_date or additional_weeks (>= 1) is required"
      );
    }
    const newEndDate = new Date(originalEndDate);
    newEndDate.setUTCDate(newEndDate.getUTCDate() + Math.floor(weeks) * 7);
    return { newEndDate, additionalWeeks: Math.floor(weeks) };
  }

  async validateExtension(params: {
    userId: string;
    orderId: string;
    orderItemId: string;
    input: ExtensionInput;
  }): Promise<{
    order: {
      id: string;
      userId: string;
      status: OrderStatus;
      paymentMethod: string | null;
      orderNumber: string;
      nurseryId: string;
    };
    orderItem: {
      id: string;
      orderId: string;
      plantId: string;
      rentalStatus: RentalStatus | null;
      rentEndDate: Date | null;
      plant: { rentPriceMonthly: Decimal | null };
    };
    validated: ValidatedExtension;
  }> {
    const { userId, orderId, orderItemId, input } = params;

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: {
        id: true,
        userId: true,
        status: true,
        paymentMethod: true,
        orderNumber: true,
        nurseryId: true,
      },
    });
    if (!order) {
      throw new BadRequestException("Order not found");
    }

    this.assertCustomerOrderAllowsRentalMutation(order, "Rental extension");

    if (!EXTENDABLE_ORDER_STATUSES.has(order.status)) {
      throw new BadRequestException(
        `Rental extension is only allowed when order status is DELIVERED or COMPLETED (current: ${order.status})`
      );
    }

    const orderItem = await this.prisma.orderItem.findFirst({
      where: { id: orderItemId, orderId: order.id },
      include: { plant: true },
    });
    if (!orderItem) {
      throw new BadRequestException("Order item not found");
    }
    if (orderItem.orderType !== OrderType.RENT) {
      throw new BadRequestException("Item is not a rental");
    }

    const rentState = orderItem.rentalStatus;
    if (!rentState || !EXTENDABLE_RENTAL_STATUSES.includes(rentState)) {
      throw new BadRequestException(
        `Rental must be ACTIVE, EXTENDED, or OVERDUE to extend (current: ${rentState ?? "unset"})`
      );
    }

    const originalEndDate = orderItem.rentEndDate;
    if (!originalEndDate) {
      throw new BadRequestException("Original end date not found");
    }

    const { newEndDate, additionalWeeks } = this.resolveNewEndDate(
      originalEndDate,
      input
    );

    if (newEndDate <= originalEndDate) {
      throw new BadRequestException("New end date must be after original end date");
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const endDay = new Date(originalEndDate);
    endDay.setUTCHours(0, 0, 0, 0);
    const daysUntilEnd = Math.ceil(
      (endDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    const windowDays = this.extensionWindowDays();
    if (
      rentState !== RentalStatus.OVERDUE &&
      daysUntilEnd > windowDays
    ) {
      throw new BadRequestException(
        `Extensions can only be requested within ${windowDays} days of rental end date`
      );
    }

    const available = await this.checkPlantAvailability(
      orderItem.plantId,
      originalEndDate,
      newEndDate,
      1,
      orderItem.id
    );
    if (!available) {
      throw new ConflictException(
        "Plant is not available for the extended period"
      );
    }

    const days = Math.ceil(
      (newEndDate.getTime() - originalEndDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const months = days / 30;
    const extensionPrice = (orderItem.plant.rentPriceMonthly || new Decimal(0)).times(
      months
    );

    return {
      order,
      orderItem: {
        id: orderItem.id,
        orderId: orderItem.orderId,
        plantId: orderItem.plantId,
        rentalStatus: orderItem.rentalStatus,
        rentEndDate: orderItem.rentEndDate,
        plant: { rentPriceMonthly: orderItem.plant.rentPriceMonthly },
      },
      validated: {
        newEndDate,
        originalEndDate,
        extensionPrice,
        additionalWeeks,
        reason: input.reason,
      },
    };
  }

  private async checkPlantAvailability(
    plantId: string,
    startDate: Date,
    endDate: Date,
    quantity: number,
    excludeOrderItemId: string
  ): Promise<boolean> {
    const conflictingRentals = await this.prisma.orderItem.count({
      where: {
        plantId,
        id: { not: excludeOrderItemId },
        orderType: OrderType.RENT,
        rentalStatus: { in: [RentalStatus.ACTIVE, RentalStatus.EXTENDED] },
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

    const plant = await this.prisma.plant.findUnique({
      where: { id: plantId },
      select: { stockQuantity: true },
    });

    return plant
      ? plant.stockQuantity - conflictingRentals >= quantity
      : false;
  }
}
