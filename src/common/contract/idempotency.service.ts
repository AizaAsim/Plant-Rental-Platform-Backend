import { createHash, randomUUID } from "crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  hashPayload(body: unknown): string {
    const s = typeof body === "string" ? body : JSON.stringify(body ?? {});
    return createHash("sha256").update(s).digest("hex");
  }

  async getReplay(
    key: string | undefined,
    route: string,
    userId: string | undefined,
    body: unknown
  ): Promise<{ statusCode: number; body: unknown } | null> {
    if (!key) return null;
    const requestHash = this.hashPayload(body);
    const row = await this.prisma.idempotencyRecord.findFirst({
      where: { key, route },
    });
    if (!row) return null;
    if (row.requestHash !== requestHash) {
      return { statusCode: 409, body: { success: false, error: { code: "CONFLICT", message: "Idempotency key reused with different payload" } } };
    }
    return { statusCode: row.statusCode, body: row.responseBody as unknown };
  }

  async save(
    key: string | undefined,
    route: string,
    userId: string | undefined,
    body: unknown,
    statusCode: number,
    responseBody: unknown
  ): Promise<void> {
    if (!key) return;
    const requestHash = this.hashPayload(body);
    await this.prisma.idempotencyRecord.upsert({
      where: {
        key_route: { key, route },
      },
      create: {
        id: randomUUID(),
        key,
        route,
        userId: userId ?? null,
        requestHash,
        statusCode,
        responseBody: responseBody as object,
      },
      update: {
        requestHash,
        statusCode,
        responseBody: responseBody as object,
      },
    });
  }
}
