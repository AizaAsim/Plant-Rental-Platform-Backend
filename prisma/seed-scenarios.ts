/** Lightweight seed: ORD-SEED-1001…1005 only (low memory — use on small prod Docker). */
import {
  orderSeedPrisma,
  purgeSeedScenarios,
  loadSeedOrderContext,
  seedSampleOrders,
} from "./seed-orders";

async function main() {
  console.log("🌱 Seed scenarios (ORD-SEED orders only)…");
  await orderSeedPrisma.$connect();
  await purgeSeedScenarios();
  const ctx = await loadSeedOrderContext();
  const { overdueRentalOrder, penaltyCalc } = await seedSampleOrders(ctx);
  console.log(`
✅ Scenarios seeded
   ORD-SEED-1005 penalty: PKR ${Number(penaltyCalc.runningTotal)} (${penaltyCalc.overdueDays} days overdue)
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
