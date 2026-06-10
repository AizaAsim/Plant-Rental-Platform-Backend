import type { ApiBodyOptions } from "@nestjs/swagger";

/** Shared optional body for jobs that support preview mode. */
export const internalJobDryRunApiBody: ApiBodyOptions = {
  description:
    "All fields optional. **Not used by mobile/vendor apps** — admin manual trigger or ops only. " +
    "Omit body or send `{}` to use defaults documented per endpoint.",
  required: false,
  schema: {
    type: "object",
    properties: {
      dry_run: {
        type: "boolean",
        default: true,
        description: "If true, only reports what would happen — no DB writes or notifications.",
      },
    },
  },
  examples: {
    preview: { summary: "Preview (recommended first)", value: { dry_run: true } },
    live: { summary: "Apply changes", value: { dry_run: false } },
  },
};

export const bootstrapPenaltyOrderApiBody: ApiBodyOptions = {
  description:
    "Inserts ORD-SEED-1005 (overdue rental + penalty) without running prisma db seed. " +
    "Requires customer1@example.com, urban-jungle-pk nursery, bird-of-paradise plant, and a Home address.",
  required: false,
  schema: {
    type: "object",
    properties: {
      dry_run: {
        type: "boolean",
        default: false,
        description: "If true, only reports what would be inserted.",
      },
    },
  },
  examples: {
    preview: { summary: "Preview", value: { dry_run: true } },
    live: { summary: "Insert order", value: { dry_run: false } },
  },
};

export const penaltySweepApiBody: ApiBodyOptions = {
  description:
    "Optional. **Runs automatically via daily cron** (`PENALTY_CRON_CRON`, default 01:00). " +
    "Manual trigger: admin JWT or admin dashboard → Jobs. Marks overdue rentals and accrues penalties.",
  required: false,
  schema: {
    type: "object",
    properties: {
      notify: {
        type: "boolean",
        default: true,
        description: "Send customer/vendor notifications for newly overdue rentals.",
      },
    },
  },
  examples: {
    default: { summary: "Live sweep (cron default)", value: {} },
    silent: { summary: "Sweep without notifications", value: { notify: false } },
  },
};

export const dueRemindersApiBody: ApiBodyOptions = {
  description:
    "Optional. **Runs automatically via daily cron** (`DUE_REMINDER_CRON_CRON`, default 08:00 UTC). " +
    "Sends notifications for rentals ending today or in 3 days. Defaults to `dry_run: true` when body omitted.",
  required: false,
  schema: {
    type: "object",
    properties: {
      dry_run: {
        type: "boolean",
        default: true,
        description: "Preview only unless explicitly set to false.",
      },
    },
  },
  examples: {
    preview: { summary: "Preview matches (safe)", value: { dry_run: true } },
    live: { summary: "Send notifications", value: { dry_run: false } },
  },
};
