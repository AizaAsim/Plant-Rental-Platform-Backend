import { BadRequestException } from "@nestjs/common";
import { OrderStatus, OrderType, RentalStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { RentalExtensionPolicyService } from "./rental-extension-policy.service";

describe("RentalExtensionPolicyService", () => {
  const prisma = {
    order: { findFirst: jest.fn() },
    orderItem: { findFirst: jest.fn(), count: jest.fn() },
    plant: { findUnique: jest.fn() },
  } as any;

  let policy: RentalExtensionPolicyService;

  beforeEach(() => {
    jest.clearAllMocks();
    policy = new RentalExtensionPolicyService(prisma);
  });

  it("rejects extension when order is not DELIVERED or COMPLETED", async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: "o1",
      userId: "u1",
      status: OrderStatus.PENDING,
      paymentMethod: "card",
      orderNumber: "ORD-1",
      nurseryId: "n1",
    });
    prisma.orderItem.findFirst.mockResolvedValue({
      id: "i1",
      orderId: "o1",
      plantId: "p1",
      orderType: OrderType.RENT,
      rentalStatus: RentalStatus.ACTIVE,
      rentEndDate: new Date("2026-06-01"),
      plant: { rentPriceMonthly: new Decimal(3000) },
    });

    await expect(
      policy.validateExtension({
        userId: "u1",
        orderId: "o1",
        orderItemId: "i1",
        input: { new_end_date: "2026-07-01" },
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("accepts new_end_date and computes extension price", async () => {
    const originalEnd = new Date("2026-06-01T00:00:00.000Z");
    prisma.order.findFirst.mockResolvedValue({
      id: "o1",
      userId: "u1",
      status: OrderStatus.DELIVERED,
      paymentMethod: "card",
      orderNumber: "ORD-1",
      nurseryId: "n1",
    });
    prisma.orderItem.findFirst.mockResolvedValue({
      id: "i1",
      orderId: "o1",
      plantId: "p1",
      orderType: OrderType.RENT,
      rentalStatus: RentalStatus.ACTIVE,
      rentEndDate: originalEnd,
      plant: { rentPriceMonthly: new Decimal(3000) },
    });
    prisma.orderItem.count.mockResolvedValue(0);
    prisma.plant.findUnique.mockResolvedValue({ stockQuantity: 5 });

    const result = await policy.validateExtension({
      userId: "u1",
      orderId: "o1",
      orderItemId: "i1",
      input: { new_end_date: "2026-07-15" },
    });

    expect(result.validated.newEndDate > originalEnd).toBe(true);
    expect(Number(result.validated.extensionPrice)).toBeGreaterThan(0);
  });

  it("resolves additional_weeks into new end date", () => {
    const original = new Date("2026-06-01T00:00:00.000Z");
    const { newEndDate, additionalWeeks } = policy.resolveNewEndDate(original, {
      additional_weeks: 2,
    });
    expect(additionalWeeks).toBe(2);
    expect(newEndDate.getUTCDate()).toBe(15);
  });
});
