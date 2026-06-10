/** Minimal seed: only ORD-SEED-1005 overdue + penalty (~lowest memory). */
import {
  orderSeedPrisma,
  purgePenaltyOrderOnly,
  seedPenaltyOrderOnly,
} from "./seed-orders";

async function main() {
  console.log("🌱 Seed penalty order only (ORD-SEED-1005)…");
  await orderSeedPrisma.$connect();
  await purgePenaltyOrderOnly();
  const { overdueRentalOrder, penaltyCalc } = await seedPenaltyOrderOnly();
  console.log(`
✅ Penalty order seeded
   PKR ${Number(penaltyCalc.runningTotal)} (${penaltyCalc.overdueDays} overdue days)
   Login: customer1@example.com / Password123!
   GET /api/v1/orders/${overdueRentalOrder.orderNumber}/penalty
`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => orderSeedPrisma.$disconnect());
