#!/usr/bin/env node
/**
 * Insert ORD-SEED-1005 (overdue + penalty) directly — no prisma db seed, no ts-node.
 *
 * On EC2 (inside Docker):
 *   docker exec -it mybackend node scripts/insert-penalty-order.cjs
 *
 * Or copy just this file into a running container:
 *   docker cp scripts/insert-penalty-order.cjs mybackend:/app/scripts/
 */
const {
  PrismaClient,
  OrderType,
  OrderStatus,
  PaymentStatus,
  PaymentType,
  TransactionStatus,
  RentalStatus,
  OrderPenaltyPayStatus,
} = require("@prisma/client");
const { Decimal } = require("@prisma/client/runtime/library");

const ORDER_NUMBER = "ORD-SEED-1005";
const OVERDUE_DAYS = 5;
const prisma = new PrismaClient();

function money(n) {
  return new Decimal(n);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function dateOnly(d) {
  return new Date(d.toISOString().slice(0, 10));
}

async function deleteExisting(orderIds) {
  if (!orderIds.length) return;
  const items = await prisma.orderItem.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const itemIds = items.map((i) => i.id);
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.orderPenalty.deleteMany({ where: { orderId: { in: orderIds } } });
  if (itemIds.length) {
    await prisma.maintenanceTask.deleteMany({ where: { orderItemId: { in: itemIds } } });
  }
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
}

async function main() {
  const customer1 = await prisma.user.findUnique({ where: { email: "customer1@example.com" } });
  const nursery2 = await prisma.nursery.findUnique({ where: { slug: "urban-jungle-pk" } });
  const bird = await prisma.plant.findFirst({ where: { slug: "bird-of-paradise" } });
  const addr = customer1
    ? await prisma.userAddress.findFirst({ where: { userId: customer1.id, label: "Home" } })
    : null;

  if (!customer1 || !nursery2 || !bird || !addr) {
    console.error(
      "Missing data in DB. Need user customer1@example.com, nursery urban-jungle-pk, plant bird-of-paradise, Home address.\n" +
        "Create those once (full seed or manually), then re-run this script."
    );
    process.exit(1);
  }

  const monthly = Number(bird.rentPriceMonthly ?? 4000);
  const daily = (monthly / 30) * 1;
  const runningTotal = Math.round(daily * OVERDUE_DAYS * 100) / 100;

  const existing = await prisma.order.findMany({
    where: { orderNumber: ORDER_NUMBER },
    select: { id: true },
  });
  await deleteExisting(existing.map((o) => o.id));

  const order = await prisma.order.create({
    data: {
      orderNumber: ORDER_NUMBER,
      userId: customer1.id,
      nurseryId: nursery2.id,
      deliveryAddressId: addr.id,
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
          plantId: bird.id,
          quantity: 1,
          orderType: OrderType.RENT,
          unitPrice: money(4000),
          depositPerUnit: money(2500),
          totalPrice: money(4000),
          rentStartDate: dateOnly(daysAgo(40)),
          rentEndDate: dateOnly(daysAgo(OVERDUE_DAYS)),
          rentalStatus: RentalStatus.OVERDUE,
        },
      },
    },
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
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

  await prisma.orderPenalty.create({
    data: {
      orderId: order.id,
      overdueDays: OVERDUE_DAYS,
      avgDailyRate: money(Math.round(daily * 100) / 100),
      penaltyMultiplier: money(1),
      runningTotal: money(runningTotal),
      payStatus: OrderPenaltyPayStatus.PENDING,
    },
  });

  console.log(`
✅ Inserted ${ORDER_NUMBER}
   Customer: customer1@example.com (Password123! if from seed)
   Penalty: PKR ${runningTotal} (${OVERDUE_DAYS} overdue days)
   GET /api/v1/orders/${ORDER_NUMBER}/penalty
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
