import { PrismaService } from "src/prisma/prisma.service";

export async function resolveOrderId(prisma: PrismaService, orderIdOrNumber: string): Promise<string | null> {
  const byId = await prisma.order.findUnique({ where: { id: orderIdOrNumber }, select: { id: true } });
  if (byId) return byId.id;
  const byNum = await prisma.order.findFirst({
    where: { orderNumber: orderIdOrNumber },
    select: { id: true },
  });
  return byNum?.id ?? null;
}
