import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { NotificationType, UserRole, DevicePlatform, Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

const PREFS_KEY = (userId: string) => `notif_prefs:${userId}`;

export type NotifyChannel = "PUSH" | "EMAIL" | "SMS" | "IN_APP";

const defaultPrefs = () => ({
  email_notifications: true,
  push_notifications: true,
  sms_notifications: true,
  notification_types: {
    ORDER: true,
    RENTAL: true,
    BOOKING: true,
    PROMOTION: true,
  },
});

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  private async loadPrefs(userId: string) {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: PREFS_KEY(userId) },
    });
    if (!row?.value) return defaultPrefs();
    try {
      return { ...defaultPrefs(), ...JSON.parse(row.value) };
    } catch {
      return defaultPrefs();
    }
  }

  private async deliverChannels(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    referenceType: string | null,
    referenceId: string | null,
    channels: NotifyChannel[]
  ) {
    const prefs = await this.loadPrefs(userId);
    const status: Record<string, { ok: boolean; detail?: string }> = {};

    for (const ch of channels) {
      if (ch === "IN_APP") {
        const nt = prefs.notification_types || {};
        const explicitlyOff = type in nt && nt[type as keyof typeof nt] === false;
        if (explicitlyOff) {
          status.IN_APP = { ok: false, detail: "User disabled this notification type" };
          continue;
        }
        await this.prisma.notification.create({
          data: {
            userId,
            title,
            message,
            type,
            referenceType: referenceType ?? undefined,
            referenceId: referenceId ?? undefined,
          },
        });
        status.IN_APP = { ok: true };
      } else if (ch === "EMAIL") {
        if (!prefs.email_notifications) {
          status.EMAIL = { ok: false, detail: "Email notifications disabled" };
          continue;
        }
        status.EMAIL = { ok: true, detail: "Mock email queued (no generic template)" };
      } else if (ch === "SMS") {
        if (!prefs.sms_notifications) {
          status.SMS = { ok: false, detail: "SMS disabled" };
          continue;
        }
        status.SMS = { ok: true, detail: "Mock SMS sent" };
      } else if (ch === "PUSH") {
        if (!prefs.push_notifications) {
          status.PUSH = { ok: false, detail: "Push disabled" };
          continue;
        }
        status.PUSH = { ok: true, detail: "Mock push sent" };
      }
    }

    return { channels: status, mock: true };
  }

  async sendInternal(body: {
    user_id: string;
    title: string;
    message: string;
    type: NotificationType;
    reference_type?: string;
    reference_id?: string;
    channels: NotifyChannel[];
  }) {
    if (!body?.user_id) {
      throw new BadRequestException("user_id is required");
    }
    if (!body?.title || !body?.message) {
      throw new BadRequestException("title and message are required");
    }
    if (!body?.type) {
      throw new BadRequestException("type is required");
    }
    if (!body.channels?.length) {
      throw new BadRequestException("channels is required");
    }
    const user = await this.prisma.user.findUnique({ where: { id: body.user_id } });
    if (!user) throw new NotFoundException("User not found");
    const result = await this.deliverChannels(
      body.user_id,
      body.title,
      body.message,
      body.type,
      body.reference_type ?? null,
      body.reference_id ?? null,
      body.channels
    );
    return { success: true, user_id: body.user_id, ...result };
  }

  async bulkSend(body: {
    user_ids?: string[];
    filter?: {
      role?: UserRole;
      is_active?: boolean;
      is_verified?: boolean;
    };
    title: string;
    message: string;
    type: NotificationType;
    channels: string[];
  }) {
    let ids: string[] = [];

    if (body.user_ids?.length) {
      ids = [...body.user_ids];
    }

    if (body.filter && Object.keys(body.filter).length > 0) {
      const where: Prisma.UserWhereInput = {
        ...(body.filter.role != null && { role: body.filter.role }),
        ...(body.filter.is_active != null && { isActive: body.filter.is_active }),
        ...(body.filter.is_verified != null && { isVerified: body.filter.is_verified }),
      };
      const filtered = await this.prisma.user.findMany({
        where,
        select: { id: true },
      });
      const fids = filtered.map((u) => u.id);
      if (body.user_ids?.length) {
        const set = new Set(fids);
        ids = ids.filter((id) => set.has(id));
      } else {
        ids = fids;
      }
    }

    if (!ids.length) {
      throw new BadRequestException("No recipients resolved from user_ids and/or filter");
    }

    const channels = (body.channels || ["IN_APP"]) as NotifyChannel[];
    let sent = 0;
    const errors: string[] = [];
    for (const uid of ids) {
      try {
        await this.deliverChannels(
          uid,
          body.title,
          body.message,
          body.type,
          null,
          null,
          channels
        );
        sent++;
      } catch (e: any) {
        errors.push(`${uid}: ${e?.message || "error"}`);
      }
    }

    return {
      success: true,
      mock: true,
      total_targets: ids.length,
      sent,
      errors: errors.length ? errors : undefined,
    };
  }

  async getSettings(userId: string) {
    return this.loadPrefs(userId);
  }

  async updateSettings(userId: string, body: any) {
    const current = await this.loadPrefs(userId);
    const next = {
      ...current,
      ...(body.email_notifications != null && { email_notifications: body.email_notifications }),
      ...(body.push_notifications != null && { push_notifications: body.push_notifications }),
      ...(body.sms_notifications != null && { sms_notifications: body.sms_notifications }),
      ...(body.notification_types && {
        notification_types: {
          ...current.notification_types,
          ...body.notification_types,
        },
      }),
    };
    await this.prisma.platformSetting.upsert({
      where: { key: PREFS_KEY(userId) },
      create: {
        key: PREFS_KEY(userId),
        value: JSON.stringify(next),
        description: "User notification preferences",
      },
      update: { value: JSON.stringify(next) },
    });
    return next;
  }

  async registerDeviceToken(
    userId: string,
    body: { token: string; platform: DevicePlatform }
  ) {
    if (!body.token || !body.platform) {
      throw new BadRequestException("token and platform are required");
    }
    await this.prisma.deviceToken.upsert({
      where: {
        userId_token: { userId, token: body.token },
      },
      create: {
        userId,
        token: body.token,
        platform: body.platform,
      },
      update: { platform: body.platform },
    });
    return { success: true, mock: true };
  }

  async sendEvent(body: {
    event_type: string;
    reference_type?: string;
    reference_id?: string;
    recipient_user_ids: string[];
    channels?: NotifyChannel[];
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!body?.event_type?.trim()) {
      throw new BadRequestException("event_type is required");
    }
    if (!body?.title?.trim() || !body?.message?.trim()) {
      throw new BadRequestException("title and message are required");
    }
    if (!body.recipient_user_ids?.length) {
      throw new BadRequestException("recipient_user_ids is required");
    }

    const channels = (body.channels?.length ? body.channels : ["IN_APP"]) as NotifyChannel[];
    const notificationType = this.mapEventToNotificationType(body.event_type);

    const results: { user_id: string; ok: boolean; detail?: string }[] = [];
    for (const uid of body.recipient_user_ids) {
      const user = await this.prisma.user.findUnique({ where: { id: uid }, select: { id: true } });
      if (!user) {
        results.push({ user_id: uid, ok: false, detail: "User not found" });
        continue;
      }
      try {
        await this.deliverChannels(
          uid,
          body.title,
          body.message,
          notificationType,
          body.reference_type ?? body.event_type,
          body.reference_id ?? null,
          channels
        );
        results.push({ user_id: uid, ok: true });
      } catch (e: any) {
        results.push({ user_id: uid, ok: false, detail: e?.message || "delivery failed" });
      }
    }

    return {
      success: true,
      event_type: body.event_type,
      metadata: body.metadata ?? {},
      delivered: results.filter((r) => r.ok).length,
      results,
      mock: true,
    };
  }

  private mapEventToNotificationType(eventType: string): NotificationType {
    const upper = eventType.toUpperCase();
    if (upper.includes("BOOKING") || upper.includes("MAINTENANCE")) return NotificationType.BOOKING;
    if (upper.includes("RENTAL") || upper.includes("EXTENSION") || upper.includes("PICKUP")) {
      return NotificationType.RENTAL;
    }
    if (upper.includes("PROMOTION")) return NotificationType.PROMOTION;
    return NotificationType.ORDER;
  }
}
