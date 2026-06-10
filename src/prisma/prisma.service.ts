import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly log = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.runMigrations();
    await this.$connect();
    await this.applyCriticalSchemaPatches();
  }

  /** Apply pending SQL migrations (safe to run every boot; no-op when up to date). */
  private runMigrations() {
    try {
      execSync('npx prisma migrate deploy', {
        stdio: 'pipe',
        encoding: 'utf8',
        env: process.env,
      });
      this.log.log('Database migrations are up to date');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn(`prisma migrate deploy did not complete: ${msg}`);
    }
  }

  /**
   * Idempotent patches for columns that block nursery reads when migrate deploy was skipped.
   * Migration 20260610120000_nursery_profile_picture.
   */
  private async applyCriticalSchemaPatches() {
    try {
      await this.$executeRawUnsafe(
        `ALTER TABLE "nurseries" ADD COLUMN IF NOT EXISTS "profile_picture_url" TEXT`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn(`Critical schema patch skipped: ${msg}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
