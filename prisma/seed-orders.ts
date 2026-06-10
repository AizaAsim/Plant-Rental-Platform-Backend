/**
 * Order scenario seeding (shared). Kept separate from seed.ts to reduce memory on prod Docker.
 */
import {
  PrismaClient,
  OrderType,
  OrderStatus,
  PaymentStatus,
  PaymentType,
  TransactionStatus,
  RentalStatus,
  OrderPenaltyPayStatus,
  EarningStatus,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export const orderSeedPrisma = new PrismaClient();

function money(n: number): Decimal {
  return new Decimal(n);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function dateOnly(d: Date): Date {
  return new Date(d.toISOString().slice(0, 10));
}

export const SEED_ORDER_NUMBERS = [
  "ORD-SEED-1001",
  "ORD-SEED-1002",
  "ORD-SEED-1003",
  "ORD-SEED-1004",
  "ORD-SEED-1005",
] as const;

export const PENALTY_ORDER_NUMBER = "ORD-SEED-1005";

function computeSeedPenalty(monthlyRent: number, quantity: number, overdueDays: number) {
  const daily = (monthlyRent / 30) * quantity;
  const runningTotal = Math.round(daily * overdueDays * 100) / 100;
  return {
    overdueDays,
    avgDailyRate: money(Math.round(daily * 100) / 100),
    penaltyMultiplier: money(1),
    runningTotal: money(runningTotal),
  };
}

async function deleteOrdersByIds(orderIds: string[]) {
  if (orderIds.length === 0) return;

  const orderItems = await orderSeedPrisma.orderItem.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const orderItemIds = orderItems.map((i) => i.id);

  await orderSeedPrisma.couponUsage.deleteMany({ where: { orderId: { in: orderIds } } });
  await orderSeedPrisma.vendorEarning.deleteMany({ where: { orderId: { in: orderIds } } });
  await orderSeedPrisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await orderSeedPrisma.orderPenalty.deleteMany({ where: { orderId: { in: orderIds } } });
  await orderSeedPrisma.manualInterventionOrder.deleteMany({ where: { orderId: { in: orderIds } } });
  await orderSeedPrisma.orderComplaintMessage.deleteMany({
    where: { complaint: { orderId: { in: orderIds } } },
  });
  await orderSeedPrisma.orderComplaint.deleteMany({ where: { orderId: { in: orderIds } } });
  await orderSeedPrisma.pickupRequest.deleteMany({ where: { orderId: { in: orderIds } } });
  if (orderItemIds.length > 0) {
    await orderSeedPrisma.maintenanceVisitLog.deleteMany({
      where: { orderItemId: { in: orderItemIds } },
    });
    await orderSeedPrisma.maintenanceTask.deleteMany({ where: { orderItemId: { in: orderItemIds } } });
  }
  await orderSeedPrisma.freelanceJob.updateMany({
    where: { orderId: { in: orderIds } },
    data: { orderId: null },
  });
  await orderSeedPrisma.order.deleteMany({ where: { id: { in: orderIds } } });
}

export async function purgeSeedScenarios() {
  const orders = await orderSeedPrisma.order.findMany({
    where: { orderNumber: { in: [...SEED_ORDER_NUMBERS] } },
    select: { id: true },
  });
  await deleteOrdersByIds(orders.map((o) => o.id));
}

export async function purgePenaltyOrderOnly() {
  const orders = await orderSeedPrisma.order.findMany({
    where: { orderNumber: PENALTY_ORDER_NUMBER },
    select: { id: true },
  });
  await deleteOrdersByIds(orders.map((o) => o.id));
}

export type SeedOrderContext = {
  customer1: { id: string };
  customer2: { id: string };
  corporate: { id: string };
  nursery1: { id: string };
  nursery2: { id: string };
  addrC1Home: { id: string };
  addrC1Office: { id: string };
  addrC2: { id: string };
  addrCorp: { id: string };
  monstera: { id: string; rentPriceMonthly: Decimal | null };
  snakePlant: { id: string; rentPriceMonthly: Decimal | null };
  pothos: { id: string; rentPriceMonthly: Decimal | null };
  birdOfParadise: { id: string; rentPriceMonthly: Decimal | null };
  zzPlant: { id: string };
  couponRent: { id: string };
  couponFlat: { id: string };
};

export async function loadSeedOrderContext(): Promise<SeedOrderContext> {
  const [
    customer1,
    customer2,
    corporate,
    nursery1,
    nursery2,
    monstera,
    snakePlant,
    pothos,
    birdOfParadise,
    zzPlant,
    couponRent,
    couponFlat,
  ] = await Promise.all([
    orderSeedPrisma.user.findUniqueOrThrow({ where: { email: "customer1@example.com" } }),
    orderSeedPrisma.user.findUniqueOrThrow({ where: { email: "customer2@example.com" } }),
    orderSeedPrisma.user.findUniqueOrThrow({ where: { email: "corporate@acme.pk" } }),
    orderSeedPrisma.nursery.findUniqueOrThrow({ where: { slug: "green-paradise-nursery" } }),
    orderSeedPrisma.nursery.findUniqueOrThrow({ where: { slug: "urban-jungle-pk" } }),
    orderSeedPrisma.plant.findFirstOrThrow({ where: { slug: "monstera-deliciosa" } }),
    orderSeedPrisma.plant.findFirstOrThrow({ where: { slug: "snake-plant" } }),
    orderSeedPrisma.plant.findFirstOrThrow({ where: { slug: "golden-pothos" } }),
    orderSeedPrisma.plant.findFirstOrThrow({ where: { slug: "bird-of-paradise" } }),
    orderSeedPrisma.plant.findFirstOrThrow({ where: { slug: "zz-plant" } }),
    orderSeedPrisma.coupon.findFirstOrThrow({ where: { code: "RENT10" } }),
    orderSeedPrisma.coupon.findFirstOrThrow({ where: { code: "WELCOME500" } }),
  ]);

  const addrC1Home = await orderSeedPrisma.userAddress.findFirstOrThrow({
    where: { userId: customer1.id, label: "Home" },
  });
  const addrC1Office = await orderSeedPrisma.userAddress.findFirstOrThrow({
    where: { userId: customer1.id, label: "Office" },
  });
  const addrC2 = await orderSeedPrisma.userAddress.findFirstOrThrow({
    where: { userId: customer2.id, label: "Home" },
  });
  const addrCorp = await orderSeedPrisma.userAddress.findFirstOrThrow({
    where: { userId: corporate.id, label: "HQ" },
  });

  return {
    customer1,
    customer2,
    corporate,
    nursery1,
    nursery2,
    monstera,
    snakePlant,
    pothos,
    birdOfParadise,
    zzPlant,
    couponRent,
    couponFlat,
    addrC1Home,
    addrC1Office,
    addrC2,
    addrCorp,
  };
}

export async function seedPenaltyOrderOnly() {
  const customer1 = await orderSeedPrisma.user.findUnique({
    where: { email: "customer1@example.com" },
  });
  const nursery2 = await orderSeedPrisma.nursery.findUnique({
    where: { slug: "urban-jungle-pk" },
  });
  const birdOfParadise = await orderSeedPrisma.plant.findFirst({
    where: { slug: "bird-of-paradise" },
  });
  const addrC1Home = customer1
    ? await orderSeedPrisma.userAddress.findFirst({
        where: { userId: customer1.id, label: "Home" },
      })
    : null;

  if (!customer1 || !nursery2 || !birdOfParadise || !addrC1Home) {
    throw new Error(
      "Missing seed prerequisites (customer1, urban-jungle-pk, bird-of-paradise, Home address). " +
        "Run full seed once with SEED_MODE=full, or use a larger instance / swap."
    );
  }

  const overdueDays = 5;
  const birdMonthlyRent = Number(birdOfParadise.rentPriceMonthly ?? 4000);
  const penaltyCalc = computeSeedPenalty(birdMonthlyRent, 1, overdueDays);

  const overdueRentalOrder = await orderSeedPrisma.order.create({
    data: {
      orderNumber: PENALTY_ORDER_NUMBER,
      userId: customer1.id,
      nurseryId: nursery2.id,
      deliveryAddressId: addrC1Home.id,
      orderType: OrderType.RENT,
      status: OrderStatus.DELIVERED,
      subtotal: money(4000),
      deliveryFee: money(200),
      taxAmount: money(420),
      discountAmount: money(0),
      depositAmount: money(2500),
      totalAmount: money(7120),
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: "card",
      deliveredAt: daysAgo(45),
      items: {
        create: {
          plantId: birdOfParadise.id,
          quantity: 1,
          orderType: OrderType.RENT,
          unitPrice: money(4000),
          depositPerUnit: money(2500),
          totalPrice: money(4000),
          rentStartDate: dateOnly(daysAgo(40)),
          rentEndDate: dateOnly(daysAgo(overdueDays)),
          rentalStatus: RentalStatus.OVERDUE,
        },
      },
    },
  });

  await orderSeedPrisma.payment.create({
    data: {
      orderId: overdueRentalOrder.id,
      userId: customer1.id,
      amount: money(7120),
      paymentType: PaymentType.ORDER,
      paymentMethod: "card",
      paymentGateway: "stripe",
      gatewayTransactionId: "pi_seed_overdue_1005",
      gatewayOrderId: "ord_seed_1005",
      status: TransactionStatus.SUCCESS,
    },
  });

  await orderSeedPrisma.orderPenalty.create({
    data: {
      orderId: overdueRentalOrder.id,
      overdueDays: penaltyCalc.overdueDays,
      avgDailyRate: penaltyCalc.avgDailyRate,
      penaltyMultiplier: penaltyCalc.penaltyMultiplier,
      runningTotal: penaltyCalc.runningTotal,
      payStatus: OrderPenaltyPayStatus.PENDING,
    },
  });

  return { overdueRentalOrder, penaltyCalc };
}

export async function seedSampleOrders(ctx: SeedOrderContext) {
  const {
    customer1,
    customer2,
    corporate,
    nursery1,
    nursery2,
    addrC1Home,
    addrC1Office,
    addrC2,
    addrCorp,
    monstera,
    snakePlant,
    pothos,
    birdOfParadise,
    zzPlant,
    couponRent,
    couponFlat,
  } = ctx;

  const rentStart = dateOnly(daysAgo(30));
  const rentEnd = dateOnly(daysAgo(1));

  const completedOrder = await orderSeedPrisma.order.create({
    data: {
      orderNumber: "ORD-SEED-1001",
      userId: customer1.id,
      nurseryId: nursery1.id,
      deliveryAddressId: addrC1Home.id,
      orderType: OrderType.RENT,
      status: OrderStatus.COMPLETED,
      subtotal: money(2500),
      deliveryFee: money(200),
      taxAmount: money(270),
      discountAmount: money(250),
      depositAmount: money(1500),
      totalAmount: money(4720),
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: "card",
      deliveredAt: daysAgo(28),
      items: {
        create: {
          plantId: monstera.id,
          quantity: 1,
          orderType: OrderType.RENT,
          unitPrice: money(2500),
          depositPerUnit: money(1500),
          totalPrice: money(2500),
          rentStartDate: rentStart,
          rentEndDate: rentEnd,
          rentalStatus: RentalStatus.RETURNED,
          actualReturnDate: rentEnd,
        },
      },
    },
    include: { items: true },
  });

  const paymentCompleted = await orderSeedPrisma.payment.create({
    data: {
      orderId: completedOrder.id,
      userId: customer1.id,
      amount: money(4720),
      paymentType: PaymentType.ORDER,
      paymentMethod: "card",
      paymentGateway: "stripe",
      gatewayTransactionId: "pi_seed_completed_001",
      gatewayOrderId: "ord_seed_1001",
      status: TransactionStatus.SUCCESS,
    },
  });

  await orderSeedPrisma.couponUsage.create({
    data: {
      couponId: couponRent.id,
      userId: customer1.id,
      orderId: completedOrder.id,
      discountApplied: money(250),
    },
  });

  await orderSeedPrisma.vendorEarning.create({
    data: {
      nurseryId: nursery1.id,
      orderId: completedOrder.id,
      orderAmount: money(4720),
      commissionRate: money(0.1),
      commissionAmount: money(472),
      netEarnings: money(4248),
      status: EarningStatus.PAID,
    },
  });

  const deliveredBuyOrder = await orderSeedPrisma.order.create({
    data: {
      orderNumber: "ORD-SEED-1002",
      userId: customer2.id,
      nurseryId: nursery2.id,
      deliveryAddressId: addrC2.id,
      orderType: OrderType.BUY,
      status: OrderStatus.DELIVERED,
      subtotal: money(2000),
      deliveryFee: money(150),
      taxAmount: money(215),
      discountAmount: money(0),
      depositAmount: money(0),
      totalAmount: money(2365),
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: "upi",
      deliveredAt: daysAgo(3),
      items: {
        create: {
          plantId: zzPlant.id,
          quantity: 1,
          orderType: OrderType.BUY,
          unitPrice: money(2000),
          totalPrice: money(2000),
        },
      },
    },
  });

  await orderSeedPrisma.payment.create({
    data: {
      orderId: deliveredBuyOrder.id,
      userId: customer2.id,
      amount: money(2365),
      paymentType: PaymentType.ORDER,
      paymentMethod: "upi",
      paymentGateway: "razorpay",
      gatewayTransactionId: "pay_seed_1002",
      status: TransactionStatus.SUCCESS,
    },
  });

  const awaitingPaymentOrder = await orderSeedPrisma.order.create({
    data: {
      orderNumber: "ORD-SEED-1003",
      userId: corporate.id,
      nurseryId: nursery1.id,
      deliveryAddressId: addrCorp.id,
      orderType: OrderType.RENT,
      status: OrderStatus.AWAITING_PAYMENT,
      subtotal: money(8000),
      deliveryFee: money(500),
      taxAmount: money(850),
      discountAmount: money(500),
      depositAmount: money(4000),
      totalAmount: money(12850),
      paymentStatus: PaymentStatus.PENDING,
      items: {
        create: [
          {
            plantId: snakePlant.id,
            quantity: 4,
            orderType: OrderType.RENT,
            unitPrice: money(1200),
            depositPerUnit: money(800),
            totalPrice: money(4800),
            rentStartDate: dateOnly(daysFromNow(7)),
            rentEndDate: dateOnly(daysFromNow(97)),
            rentalStatus: RentalStatus.ACTIVE,
          },
          {
            plantId: pothos.id,
            quantity: 4,
            orderType: OrderType.RENT,
            unitPrice: money(800),
            depositPerUnit: money(400),
            totalPrice: money(3200),
            rentStartDate: dateOnly(daysFromNow(7)),
            rentEndDate: dateOnly(daysFromNow(97)),
            rentalStatus: RentalStatus.ACTIVE,
          },
        ],
      },
    },
  });

  await orderSeedPrisma.couponUsage.create({
    data: {
      couponId: couponFlat.id,
      userId: corporate.id,
      orderId: awaitingPaymentOrder.id,
      discountApplied: money(500),
    },
  });

  const activeRentalOrder = await orderSeedPrisma.order.create({
    data: {
      orderNumber: "ORD-SEED-1004",
      userId: customer1.id,
      nurseryId: nursery2.id,
      deliveryAddressId: addrC1Office.id,
      orderType: OrderType.RENT,
      status: OrderStatus.DELIVERED,
      subtotal: money(4000),
      deliveryFee: money(300),
      taxAmount: money(430),
      discountAmount: money(0),
      depositAmount: money(2500),
      totalAmount: money(7230),
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: "card",
      deliveredAt: daysAgo(10),
      items: {
        create: {
          plantId: birdOfParadise.id,
          quantity: 1,
          orderType: OrderType.RENT,
          unitPrice: money(4000),
          depositPerUnit: money(2500),
          totalPrice: money(4000),
          rentStartDate: dateOnly(daysAgo(10)),
          rentEndDate: dateOnly(daysFromNow(80)),
          rentalStatus: RentalStatus.ACTIVE,
        },
      },
    },
    include: { items: true },
  });

  await orderSeedPrisma.payment.create({
    data: {
      orderId: activeRentalOrder.id,
      userId: customer1.id,
      amount: money(7230),
      paymentType: PaymentType.ORDER,
      paymentMethod: "card",
      paymentGateway: "stripe",
      gatewayTransactionId: "pi_seed_active_004",
      status: TransactionStatus.SUCCESS,
    },
  });

  await orderSeedPrisma.rentalExtension.create({
    data: {
      orderItemId: activeRentalOrder.items[0].id,
      originalEndDate: dateOnly(daysFromNow(80)),
      newEndDate: dateOnly(daysFromNow(110)),
      extensionPrice: money(900),
      paymentStatus: PaymentStatus.PENDING,
    },
  });

  const overdueDays = 5;
  const birdMonthlyRent = Number(ctx.birdOfParadise.rentPriceMonthly ?? 4000);
  const penaltyCalc = computeSeedPenalty(birdMonthlyRent, 1, overdueDays);

  const overdueRentalOrder = await orderSeedPrisma.order.create({
    data: {
      orderNumber: PENALTY_ORDER_NUMBER,
      userId: customer1.id,
      nurseryId: nursery2.id,
      deliveryAddressId: addrC1Home.id,
      orderType: OrderType.RENT,
      status: OrderStatus.DELIVERED,
      subtotal: money(4000),
      deliveryFee: money(200),
      taxAmount: money(420),
      discountAmount: money(0),
      depositAmount: money(2500),
      totalAmount: money(7120),
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: "card",
      deliveredAt: daysAgo(45),
      items: {
        create: {
          plantId: birdOfParadise.id,
          quantity: 1,
          orderType: OrderType.RENT,
          unitPrice: money(4000),
          depositPerUnit: money(2500),
          totalPrice: money(4000),
          rentStartDate: dateOnly(daysAgo(40)),
          rentEndDate: dateOnly(daysAgo(overdueDays)),
          rentalStatus: RentalStatus.OVERDUE,
        },
      },
    },
    include: { items: true },
  });

  await orderSeedPrisma.payment.create({
    data: {
      orderId: overdueRentalOrder.id,
      userId: customer1.id,
      amount: money(7120),
      paymentType: PaymentType.ORDER,
      paymentMethod: "card",
      paymentGateway: "stripe",
      gatewayTransactionId: "pi_seed_overdue_1005",
      gatewayOrderId: "ord_seed_1005",
      status: TransactionStatus.SUCCESS,
    },
  });

  await orderSeedPrisma.orderPenalty.create({
    data: {
      orderId: overdueRentalOrder.id,
      overdueDays: penaltyCalc.overdueDays,
      avgDailyRate: penaltyCalc.avgDailyRate,
      penaltyMultiplier: penaltyCalc.penaltyMultiplier,
      runningTotal: penaltyCalc.runningTotal,
      payStatus: OrderPenaltyPayStatus.PENDING,
    },
  });

  return {
    completedOrder,
    paymentCompleted,
    deliveredBuyOrder,
    awaitingPaymentOrder,
    activeRentalOrder,
    overdueRentalOrder,
    penaltyCalc,
  };
}
