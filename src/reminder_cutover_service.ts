import { createHash } from 'node:crypto';
import { marketplaceDeadlineRequestSchema, type MarketplaceDeadlineRequest } from './marketplace_deadline_schema';
import { infrai } from './infrai';

export type ReminderDecision = {
  status: 'scheduled' | 'no-reminder';
  reason: string;
  reminderAt: string | null;
  taskUrl: string | null;
  idempotencyRef: string;
  jobId?: string;
};

function stableRef(input: MarketplaceDeadlineRequest): string {
  return createHash('sha256')
    .update(JSON.stringify({
      orderId: input.orderId,
      sellerId: input.sellerId,
      deadlineAt: input.deadlineAt
    }))
    .digest('hex')
    .slice(0, 16);
}

function minutesUntilDeadline(deadlineAt: string, now: Date): number {
  const deadlineMs = new Date(deadlineAt).getTime();
  return Math.floor((deadlineMs - now.getTime()) / 60000);
}

function toCronExpr(when: Date): string {
  const minute = when.getUTCMinutes();
  const hour = when.getUTCHours();
  const day = when.getUTCDate();
  const month = when.getUTCMonth() + 1;
  return `${minute} ${hour} ${day} ${month} *`;
}

export function decideReminder(input: MarketplaceDeadlineRequest, now = new Date()): ReminderDecision {
  const idempotencyRef = stableRef(input);
  const missingAssets = input.sellerAssets.filter((asset) => asset.status === 'missing');
  const minutesLeft = minutesUntilDeadline(input.deadlineAt, now);

  if (minutesLeft <= 0) {
    return {
      status: 'no-reminder',
      reason: 'deadline already passed',
      reminderAt: null,
      taskUrl: null,
      idempotencyRef
    };
  }

  if (missingAssets.length === 0 && input.buyerUpdate.shippingWindowConfirmed && input.orderHandoff.warehouseReady && input.orderHandoff.carrierBooked) {
    return {
      status: 'no-reminder',
      reason: 'order handoff is ready',
      reminderAt: null,
      taskUrl: null,
      idempotencyRef
    };
  }

  const reminderTime = new Date(new Date(input.deadlineAt).getTime() - 60 * 60 * 1000);
  const effectiveReminderTime = reminderTime > now ? reminderTime : now;
  const taskUrl = new URL(input.reminderTaskUrl);
  taskUrl.searchParams.set('orderId', input.orderId);
  taskUrl.searchParams.set('sellerId', input.sellerId);
  taskUrl.searchParams.set('ref', idempotencyRef);

  return {
    status: 'scheduled',
    reason: missingAssets.length > 0 ? 'seller assets missing before deadline' : 'buyer update or handoff still incomplete',
    reminderAt: effectiveReminderTime.toISOString(),
    taskUrl: taskUrl.toString(),
    idempotencyRef
  };
}

export async function scheduleMarketplaceReminder(raw: unknown, now = new Date()): Promise<ReminderDecision> {
  const input = marketplaceDeadlineRequestSchema.parse(raw);
  const decision = decideReminder(input, now);

  if (decision.status === 'no-reminder') {
    return decision;
  }

  const cron_expr = toCronExpr(new Date(decision.reminderAt as string));
  const created = await infrai.cron.create({
    cron_expr,
    task: decision.taskUrl as string
  });

  return {
    ...decision,
    jobId: created.job_id
  };
}
